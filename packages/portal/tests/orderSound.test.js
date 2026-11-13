import test from 'node:test';
import assert from 'node:assert/strict';
import { unlockOrderSound, playOrderChime } from '../src/services/orderSound.js';

test('audio stays silent before interaction and schedules a short two-note chime after unlocking', () => {
  const original=globalThis.AudioContext;
  const tones=[];
  class Audio {
    state='suspended'; currentTime=10; destination={};
    resume() {this.state='running';return Promise.resolve();}
    createOscillator() {const tone={frequency:{value:0},connect(){},disconnect(){},start(at){this.at=at;},stop(at){this.end=at;}};tones.push(tone);return tone;}
    createGain() {return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
  }
  try {
    assert.equal(playOrderChime(),false);
    globalThis.AudioContext=Audio;
    unlockOrderSound();
    assert.equal(playOrderChime(),true);
    assert.deepEqual(tones.map(tone=>tone.frequency.value),[740,988]);
    assert(tones.every(tone=>tone.end-tone.at<0.25));
  } finally {globalThis.AudioContext=original;}
});
