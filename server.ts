import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from 'stripe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Stripe initialization with lazy loading pattern
  let stripe: Stripe | null = null;
  const getStripe = () => {
    if (!stripe && process.env.STRIPE_SECRET_KEY) {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return stripe;
  };

  app.use(express.json());

  // Stripe Checkout Session Endpoint
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const client = getStripe();
      if (!client) {
        throw new Error("Stripe is not configured. Please add STRIPE_SECRET_KEY.");
      }

      const { email, userId, planType } = req.body;
      const appUrl = process.env.APP_URL || `http://${req.headers.host}`;

      // Choose price ID based on plan type
      const priceId = planType === 'yearly' 
        ? process.env.STRIPE_PRICE_YEARLY_ID 
        : process.env.STRIPE_PRICE_MONTHLY_ID;

      if (!priceId) {
        throw new Error(`Stripe Price ID for ${planType} is not configured.`);
      }

      const session = await client.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        customer_email: email,
        client_reference_id: userId,
        success_url: `${appUrl}?subscription_success=true`,
        cancel_url: `${appUrl}/subscription?cancel=true`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
