export function getPacks() {
  return {
    starter: { price: process.env.STRIPE_PRICE_STARTER, credits: Number(process.env.CREDITS_STARTER) },
    creator: { price: process.env.STRIPE_PRICE_CREATOR, credits: Number(process.env.CREDITS_CREATOR) },
    studio: { price: process.env.STRIPE_PRICE_STUDIO, credits: Number(process.env.CREDITS_STUDIO) },
  };
}
