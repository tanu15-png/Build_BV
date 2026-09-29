# CampusEats Architecture

## 1. System Architecture

``` mermaid
flowchart TD
    A[CampusEats] --> B[Student]
    A --> C[Canteen]
    B --> D[Student Login<br/>Gmail: @banasthali.in]
    C --> E[Canteen Login<br/>Email + Selected Canteen + Secret Code]
    D --> F[Student Home]
    E --> G[Canteen Dashboard]
```

## 2. Student Workflow

``` mermaid
flowchart TD
    A[Login] --> B[Select Canteen]
    B --> C[Browse Menu]
    C --> D[Add Items to Cart]
    D --> E[Select Pickup Time]
    E --> F[Place Order]
    F --> G[Complete Payment]
    G --> H[Generate 3-Character Alphanumeric Order ID]
    H --> I[Order Confirmation]
    I --> J[Wait for Canteen]
    J --> K[Receive READY Notification]
    K --> L[Go to Canteen]
    L --> M[Show Order ID]
    M --> N[Order ID Verified by Canteen]
    N --> O[Pick Up Order]
```

### Student-side rules

-   Students sign in using their `@banasthali.in` Gmail address.
-   A cart can contain items from **one canteen only** at a time.
-   The student selects an estimated pickup time before placing the
    order.
-   Payment must be verified before the order appears on the canteen
    dashboard.
-   After successful payment, the system generates a 3-character
    alphanumeric Order ID (for example, `AZ1` or `B7J`).
-   The student receives a notification when the order is ready and
    shows the Order ID at pickup.

## 3. Canteen Workflow

``` mermaid
flowchart TD
    A[Canteen Login] --> B[Select / Confirm Canteen]
    B --> C[Enter Canteen Secret Code]
    C --> D[Canteen Dashboard]
    D --> E[Incoming Orders]
    E --> F{Accept or Reject?}
    F -->|Accept| G[Accepted]
    G --> H[Preparing]
    H --> I[Ready]
    I --> J[Notify Student]
    J --> K[Student Arrives]
    K --> L[Verify Order ID]
    L --> M[Picked Up]
    F -->|Reject| N[Order Rejected]
    N --> O[Initiate Refund]
```

### Canteen-side rules

-   Canteen members select the canteen they represent and use its secret
    code to access its dashboard.
-   Incoming orders are displayed only after payment verification.
-   The dashboard order card displays the Order ID and ordered items.
-   Canteen members can accept or reject an incoming order.
-   Accepted orders move through **Accepted → Preparing → Ready → Picked
    Up**.
-   The canteen notifies the student when an order is ready and verifies
    the Order ID at pickup.
-   If an order is rejected, a refund is initiated. Accepted orders
    cannot be cancelled or refunded.
-   Canteen members can pause incoming orders and disable individual
    menu items.

## 4. Order Status Flow

``` mermaid
stateDiagram-v2
    [*] --> PaymentPending
    PaymentPending --> PaymentVerified: Payment successful
    PaymentVerified --> AwaitingCanteenDecision: Order appears on dashboard
    AwaitingCanteenDecision --> Accepted: Canteen accepts
    AwaitingCanteenDecision --> Rejected: Canteen rejects
    Accepted --> Preparing
    Preparing --> Ready
    Ready --> PickedUp: Order ID verified
    Rejected --> RefundInitiated
    PickedUp --> [*]
    RefundInitiated --> [*]
```

## 5. Project Directory Structure

``` text
CampusEats/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/ (config.py, security.py, constants.py)
│   │   ├── database/
│   │   │   ├── database.py
│   │   │   ├── models/ (user.py, canteen.py, menu_item.py, order.py, order_item.py)
│   │   │   └── migrations/
│   │   ├── schemas/ (auth.py, user.py, canteen.py, menu.py, order.py)
│   │   ├── api/ (auth.py, canteens.py, menu.py, orders.py)
│   │   ├── services/ (auth_service.py, canteen_service.py, menu_service.py, order_service.py, order_id_service.py)
│   │   ├── repositories/ (user_repository.py, canteen_repository.py, menu_repository.py, order_repository.py)
│   │   ├── seed/ (canteens.py, menu.py)
│   │   └── utils/ (validators.py, order_status.py)
│   ├── tests/ (test_auth.py, test_canteens.py, test_menu.py, test_orders.py)
│   ├── alembic.ini
│   ├── pyproject.toml
│   ├── .env
│   └── README.md
├── frontend/
│   ├── public/assets/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/ (Navbar.jsx, Footer.jsx, CanteenCard.jsx, MenuItemCard.jsx, CartItem.jsx, OrderCard.jsx, OrderStatus.jsx, PickupTimeSelector.jsx, ProtectedRoute.jsx)
│   │   ├── pages/
│   │   │   ├── auth/ (Login.jsx, StudentLogin.jsx, CanteenLogin.jsx)
│   │   │   ├── student/ (Home.jsx, Canteens.jsx, CanteenMenu.jsx, Cart.jsx, Checkout.jsx, OrderConfirmation.jsx, MyOrders.jsx)
│   │   │   └── canteen/ (Dashboard.jsx, Orders.jsx, OrderDetails.jsx, MenuManagement.jsx, CanteenSettings.jsx, PickupVerification.jsx)
│   │   ├── context/ (AuthContext.jsx, CartContext.jsx)
│   │   ├── services/ (api.js, authApi.js, canteenApi.js, menuApi.js, orderApi.js)
│   │   ├── hooks/ (useAuth.js, useCart.js, useOrders.js)
│   │   ├── utils/ (constants.js, validators.js, orderStatus.js)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
├── docs/
│   ├── requirements.md
│   ├── architecture.md
│   ├── authentication.md
│   ├── order-flow.md
│   └── canteen-management.md
├── .gitignore
├── README.md
└── AGENTS.md
```

## 6. Main Components

  -----------------------------------------------------------------------
  Layer                               Responsibility
  ----------------------------------- -----------------------------------
  Frontend                            Student and canteen interfaces,
                                      menu browsing, cart, checkout,
                                      order tracking, and pickup
                                      verification

  Backend API                         Authentication, canteen and menu
                                      data, order creation, status
                                      updates, and order ID generation

  Database                            Stores users, canteens, menu items,
                                      orders, and order items

  Services                            Implements authentication, canteen,
                                      menu, order, and order-ID logic

  Repositories                        Handles database access

  Tests                               Tests authentication, canteen,
                                      menu, and order behavior
  -----------------------------------------------------------------------
