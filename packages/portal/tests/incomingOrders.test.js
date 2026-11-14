import test from 'node:test';
import assert from 'node:assert/strict';
import { createIncomingOrderTracker } from '../src/services/incomingOrders.js';

const order = (id, status='RECEIVED', createdAt='2026-11-13T10:00:00Z') => ({id,status,createdAt});
test('a newly confirmed payment chimes once, without replay on reads or reload', () => {
  const {create,sounds}=setup(); let tracker=create();
  tracker.observe([{...order('accepted','ACCEPTED'),paymentStatus:'AWAITING_PAYMENT'}]);
  const paid={...order('accepted','ACCEPTED'),paymentStatus:'PAID'};
  tracker.observe([paid]); tracker.observe([paid]); assert.equal(sounds(),1);
  tracker=create();tracker.observe([paid]);tracker.observe([paid]);assert.equal(sounds(),1);
});
function setup() {
  const values = new Map(); let sounds=0;
  const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const create=()=>createIncomingOrderTracker({owner:'staff:canteen',storage,notify:()=>sounds++});
  return {create,sounds:()=>sounds};
}

test('initial orders, repeated reads and status changes are silent; a new incoming batch chimes once',()=>{
  const {create,sounds}=setup();const tracker=create();
  tracker.observe([order('existing')]);assert.equal(sounds(),0);
  tracker.observe([order('existing')]);
  tracker.observe([order('existing','ACCEPTED'),order('ready','READY')]);assert.equal(sounds(),0);
  tracker.observe([order('new-a','RECEIVED','2026-11-13T10:01:00Z'),order('new-b','RECEIVED','2026-11-13T10:01:01Z'),order('existing','READY')]);
  assert.equal(sounds(),1);
  tracker.observe([order('new-a'),order('new-b')]);assert.equal(sounds(),1);
});

test('pagination, older unseen orders and reloading do not replay sounds',()=>{
  const {create,sounds}=setup();let tracker=create();
  tracker.observe([order('first')]);
  tracker.observe([order('older','RECEIVED','2026-11-12T10:00:00Z')],{append:true});
  tracker.observe([order('older-unseen','RECEIVED','2026-11-12T09:00:00Z')]);assert.equal(sounds(),0);
  tracker.observe([order('fresh','RECEIVED','2026-11-13T10:02:00Z')]);assert.equal(sounds(),1);
  tracker=create();tracker.observe([order('fresh','RECEIVED','2026-11-13T10:02:00Z')]);
  tracker.observe([order('fresh','RECEIVED','2026-11-13T10:02:00Z')]);assert.equal(sounds(),1);
});

test('an empty initial queue and unavailable browser storage still detect new incoming orders',()=>{
  let sounds=0;
  const tracker=createIncomingOrderTracker({owner:'staff',storage:{getItem:()=>{throw Error('disabled');},setItem:()=>{throw Error('disabled');}},notify:()=>sounds++});
  tracker.observe([]);tracker.observe([order('new')]);tracker.observe([order('new','PREPARING')]);
  assert.equal(sounds,1);
});
