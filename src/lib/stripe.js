import Stripe from 'stripe'

// Lazy initialization to avoid build-time errors when STRIPE_SECRET_KEY is not available
let stripeInstance = null

export function getStripe() {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return stripeInstance
}

// For backwards compatibility - this getter returns the lazy-initialized instance
export const stripe = {
  get customers() { return getStripe().customers },
  get subscriptions() { return getStripe().subscriptions },
  get charges() { return getStripe().charges },
  get paymentIntents() { return getStripe().paymentIntents },
  get checkout() { return getStripe().checkout },
  get products() { return getStripe().products },
  get prices() { return getStripe().prices },
  get webhooks() { return getStripe().webhooks },
}
