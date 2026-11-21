// backend/services/payloadGenerator.js
// Sprint 5 — AI-Assisted Smart Payload Engine 🧠
// Provider + event bolo, Faker.js se REALISTIC payload khud banta hai.
// Har call pe FRESH random data — do baar same payload kabhi nahi.

const { faker } = require('@faker-js/faker');

// ── Chhote helpers (baar baar na likhna pare) ──
const pick = (arr) => faker.helpers.arrayElement(arr);
const sha40 = () => faker.string.alphanumeric(40).toLowerCase(); // GitHub commit sha
const up = (n) => faker.string.alphanumeric(n).toUpperCase();    // Stripe/Slack style IDs
const pastIso = () => new Date(Date.now() - faker.number.int({ min: 0, max: 7200000 })).toISOString();

// ═════════ GITHUB 🐙 ═════════
const github = {
    push: () => ({
        ref: `refs/heads/${pick(['main', 'develop', 'feature/auth', 'fix/chaos-bug'])}`,
        before: sha40(),
        after: sha40(),
        repository: {
            id: faker.number.int({ min: 1000000, max: 9999999 }),
            name: 'devpulse',
            full_name: `${faker.internet.username()}/devpulse`,
            private: false,
        },
        pusher: { name: faker.internet.username(), email: faker.internet.email() },
        commits: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => ({
            id: sha40(),
            message: faker.hacker.phrase(), // commit message hacker style 😄
            timestamp: pastIso(),
            author: { name: faker.person.fullName(), email: faker.internet.email() },
            modified: ['src/server.js'],
        })),
        sender: { login: faker.internet.username(), id: faker.number.int({ min: 1000, max: 99999 }) },
    }),

    pull_request: () => ({
        action: pick(['opened', 'synchronize', 'closed']),
        number: faker.number.int({ min: 1, max: 200 }),
        pull_request: {
            title: faker.hacker.phrase(),
            state: 'open',
            user: { login: faker.internet.username() },
            head: { ref: 'feature/new-api', sha: sha40() },
            base: { ref: 'main', sha: sha40() },
        },
        repository: { full_name: `${faker.internet.username()}/devpulse` },
    }),

    issues: () => ({
        action: pick(['opened', 'closed']),
        issue: {
            number: faker.number.int({ min: 1, max: 300 }),
            title: `Bug: ${faker.hacker.phrase()}`,
            state: 'open',
            user: { login: faker.internet.username() },
            labels: [{ name: pick(['bug', 'enhancement', 'help wanted']) }],
            created_at: pastIso(),
        },
        repository: { full_name: `${faker.internet.username()}/devpulse` },
    }),
};

// ═════════ STRIPE 💳 (Stripe paise cents me gin ta hai — 2500 = $25) ═════════
const stripe = {
    'payment_intent.succeeded': () => ({
        id: `evt_${faker.string.alphanumeric(24)}`,
        object: 'event',
        type: 'payment_intent.succeeded',
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        data: {
            object: {
                id: `pi_${faker.string.alphanumeric(24)}`,
                object: 'payment_intent',
                amount: faker.number.int({ min: 1500, max: 250000 }),
                currency: 'usd',
                status: 'succeeded',
                customer: `cus_${faker.string.alphanumeric(14)}`,
                description: `Payment by ${faker.person.fullName()}`,
                receipt_email: faker.internet.email(),
                metadata: { order_id: up(8) },
            },
        },
    }),

    'payment_intent.payment_failed': () => ({
        id: `evt_${faker.string.alphanumeric(24)}`,
        object: 'event',
        type: 'payment_intent.payment_failed',
        created: Math.floor(Date.now() / 1000),
        data: {
            object: {
                id: `pi_${faker.string.alphanumeric(24)}`,
                amount: faker.number.int({ min: 1500, max: 250000 }),
                currency: 'usd',
                status: 'requires_payment_method',
                last_payment_error: {
                    message: pick(['Your card was declined.', 'Insufficient funds.', 'Card expired.']),
                },
            },
        },
    }),

    'customer.subscription.created': () => ({
        id: `evt_${faker.string.alphanumeric(24)}`,
        object: 'event',
        type: 'customer.subscription.created',
        created: Math.floor(Date.now() / 1000),
        data: {
            object: {
                id: `sub_${faker.string.alphanumeric(14)}`,
                status: pick(['active', 'trialing', 'past_due']),
                plan: { nickname: pick(['Free', 'Pro', 'Team']), interval: 'month' },
                customer: `cus_${faker.string.alphanumeric(14)}`,
            },
        },
    }),
};

// ═════════ SHOPIFY 🛍️ ═════════
const shopify = {
    'orders/create': () => ({
        id: faker.number.int({ min: 5000000000000, max: 5999999999999 }),
        name: `#${faker.number.int({ min: 1001, max: 1099 })}`,
        total_price: faker.commerce.price({ min: 20, max: 500 }),
        currency: 'USD',
        financial_status: 'paid',
        customer: {
            first_name: faker.person.firstName(),
            last_name: faker.person.lastName(),
            email: faker.internet.email(),
        },
        line_items: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => ({
            title: faker.commerce.productName(),
            quantity: faker.number.int({ min: 1, max: 3 }),
            price: faker.commerce.price({ min: 5, max: 120 }),
            sku: up(8),
        })),
        shipping_address: {
            city: faker.location.city(),
            country: faker.location.country(),
            zip: faker.location.zipCode(),
        },
        created_at: pastIso(),
    }),

    'products/create': () => ({
        id: faker.number.int({ min: 7000000000000, max: 7999999999999 }),
        title: faker.commerce.productName(),
        vendor: faker.company.name(),
        product_type: pick(['Shirt', 'Gadget', 'Book', 'Beauty']),
        status: 'active',
        variants: [{ price: faker.commerce.price({ min: 10, max: 99 }), inventory_quantity: faker.number.int({ min: 2, max: 150 }) }],
        created_at: pastIso(),
    }),

    'app/uninstalled': () => ({ shop_domain: `${faker.internet.username()}.myshopify.com` }),
};

// ═════════ SLACK 💬 ═════════
const slack = {
    url_verification: () => ({
        token: faker.string.alphanumeric(24),
        challenge: faker.string.alphanumeric(32),
        type: 'url_verification',
        team_id: `T${up(8)}`,
    }),
    'message.channels': () => ({
        type: 'event_callback',
        team_id: `T${up(8)}`,
        event: {
            type: 'message',
            text: faker.lorem.sentence(),
            user: `U${up(8)}`,
            ts: `${Math.floor(Date.now() / 1000)}.${faker.string.numeric(6)}`,
            channel: `C${up(8)}`,
        },
    }),
};

// ═════════ GENERIC ⚙️ (apne app ke events) ═════════
const generic = {
    'user.signup': () => ({
        event: 'user.signup',
        user: {
            id: faker.string.uuid(),
            name: faker.person.fullName(),
            email: faker.internet.email(),
            plan: pick(['free', 'pro', 'enterprise']),
            created_at: pastIso(),
        },
        source: 'devpulse-simulator',
    }),
    'payment.completed': () => ({
        event: 'payment.completed',
        transaction_id: `txn_${faker.string.alphanumeric(16)}`,
        amount: faker.number.int({ min: 500, max: 90000 }),
        currency: pick(['USD', 'PKR', 'EUR']),
        method: pick(['card', 'bank_transfer', 'wallet']),
        customer: { email: faker.internet.email(), name: faker.person.fullName() },
    }),
};

// ── Registry: frontend dropdown isi se bharega ──
const SCHEMAS = {
    github: { label: 'GitHub', icon: '🐙', events: github },
    stripe: { label: 'Stripe', icon: '💳', events: stripe },
    shopify: { label: 'Shopify', icon: '🛍️', events: shopify },
    slack: { label: 'Slack', icon: '💬', events: slack },
    generic: { label: 'Generic', icon: '⚙️', events: generic },
};

// Providers list — dropdown ke liye
function getProviders() {
    return Object.entries(SCHEMAS).map(([id, s]) => ({
        id,
        label: s.label,
        icon: s.icon,
        events: Object.keys(s.events),
    }));
}

// Main engine: provider + eventType → fresh payload
function generatePayload(provider, eventType) {
    const schema = SCHEMAS[provider];
    if (!schema) throw new Error(`Unknown provider: ${provider}`);
    const fn = schema.events[eventType];
    if (!fn) throw new Error(`Event "${eventType}" provider "${provider}" me nahi mila`);
    return { provider, eventType, payload: fn() };
}

module.exports = { generatePayload, getProviders };