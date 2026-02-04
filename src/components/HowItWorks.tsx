import { MessageSquare, Brain, Target } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      title: "Ask",
      description: "Visitors ask questions about pricing, features, or get product recommendations naturally.",
      icon: MessageSquare
    },
    {
      title: "Answer", 
      description: "AI instantly responds with accurate info from your docs, pricing calculators, and CRM data.",
      icon: Brain
    },
    {
      title: "Convert",
      description: "Qualified leads get quotes, book demos, or purchase directly through the chat interface.",
      icon: Target
    }
  ];

  return (
    <section className="py-24 px-6 bg-background">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            How It Works
          </h2>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            Transform website visitors into customers with AI-powered conversations
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div 
              key={step.title}
              className="relative group"
            >
              {/* Connection line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-purple-accent/30 to-purple-accent/10 transform -translate-x-1/2 z-0" />
              )}
              
              <div className="relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1">
                {/* Step number */}
                <div className="absolute -top-4 left-8">
                  <div className="w-8 h-8 bg-purple-accent text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                </div>

                {/* Icon */}
                <div className="text-purple-accent mb-4">
                  <step.icon size={36} strokeWidth={1.5} />
                </div>
                
                {/* Content */}
                <h3 className="text-2xl font-bold text-foreground mb-4">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;