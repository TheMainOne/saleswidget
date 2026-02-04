import { useState } from "react";
import { Button } from "@/components/ui/button";
import ContactDialog from "@/components/ContactDialog";

const Pricing = () => {
  const [contactOpen, setContactOpen] = useState(false);
  const [contactType, setContactType] = useState<"demo_request" | "general_inquiry" | "sales_question" | "signup">("signup");

  const handleContactClick = (type: "demo_request" | "general_inquiry" | "sales_question" | "signup") => {
    setContactType(type);
    setContactOpen(true);
  };

  const plans = [
    {
      name: "Starter",
      price: "$99",
      period: "/month",
      description: "Perfect for small businesses getting started",
      features: [
        "Up to 1,000 conversations/month",
        "Basic AI responses",
        "Email support",
        "Standard analytics",
        "1 website integration"
      ],
      highlighted: false
    },
    {
      name: "Growth", 
      price: "$299",
      period: "/month",
      description: "Ideal for growing businesses with higher volume",
      features: [
        "Up to 10,000 conversations/month",
        "Advanced AI + pricing calculator",
        "CRM integration",
        "Priority support",
        "3 website integrations",
        "Custom branding",
        "Advanced analytics"
      ],
      highlighted: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "Tailored solutions for large organizations",
      features: [
        "Unlimited conversations",
        "Custom AI training",
        "Dedicated account manager",
        "24/7 phone support", 
        "Unlimited integrations",
        "White-label solution",
        "Custom reporting",
        "SLA guarantee"
      ],
      highlighted: false
    }
  ];

  return (
    <section className="py-24 px-6 bg-background">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your business needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div 
              key={plan.name}
              className={`relative rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 ${
                plan.highlighted 
                  ? 'bg-gradient-to-b from-purple-accent to-accent text-white shadow-2xl scale-105' 
                  : 'bg-white shadow-lg hover:shadow-xl'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-white text-purple-accent px-4 py-2 rounded-full text-sm font-bold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className={`text-2xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-foreground'}`}>
                  {plan.name}
                </h3>
                <div className="mb-4">
                  <span className={`text-5xl font-bold ${plan.highlighted ? 'text-white' : 'text-foreground'}`}>
                    {plan.price}
                  </span>
                  <span className={`text-lg ${plan.highlighted ? 'text-white/80' : 'text-muted-foreground'}`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`${plan.highlighted ? 'text-white/90' : 'text-muted-foreground'}`}>
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      plan.highlighted ? 'bg-white/20' : 'bg-purple-accent/10'
                    }`}>
                      <span className={`text-xs ${plan.highlighted ? 'text-white' : 'text-purple-accent'}`}>✓</span>
                    </div>
                    <span className={`${plan.highlighted ? 'text-white/90' : 'text-foreground'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button 
                className={`w-full py-6 text-lg font-semibold transition-all duration-300 ${
                  plan.highlighted 
                    ? 'bg-white text-purple-accent hover:bg-white/90' 
                    : 'bg-purple-accent text-white hover:bg-purple-accent/90'
                }`}
                onClick={() => handleContactClick(plan.name === "Enterprise" ? "sales_question" : "signup")}
              >
                {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
              </Button>
            </div>
          ))}
        </div>
      </div>
      <ContactDialog isOpen={contactOpen} onOpenChange={setContactOpen} defaultType={contactType} />
    </section>
  );
};

export default Pricing;