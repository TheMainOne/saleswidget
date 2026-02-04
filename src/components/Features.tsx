import { Database, Calculator, Link2, FileText, BarChart3, GitBranch } from "lucide-react";

const Features = () => {
  const features = [
    {
      title: "RAG Knowledge Base",
      description: "AI answers from your documentation, FAQ, and knowledge base with accurate citations.",
      icon: Database
    },
    {
      title: "Pricing Calculator", 
      description: "Generate instant quotes and pricing based on user requirements and custom parameters.",
      icon: Calculator
    },
    {
      title: "CRM Integration",
      description: "Automatically sync leads, conversations, and quotes with your existing CRM system.",
      icon: Link2
    },
    {
      title: "Source Citations",
      description: "Every AI response includes links to source documents for transparency and trust.",
      icon: FileText
    },
    {
      title: "Analytics Dashboard",
      description: "Track conversations, conversion rates, and optimize your AI sales performance.",
      icon: BarChart3
    },
    {
      title: "Smart Routing",
      description: "Route complex queries to human agents while handling common questions automatically.",
      icon: GitBranch
    }
  ];

  return (
    <section className="py-24 px-6 bg-gradient-to-b from-cream to-background">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            Powerful Features
          </h2>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to turn your website into a sales powerhouse
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div 
              key={feature.title}
              className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="text-purple-accent mb-4">
                <feature.icon size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;