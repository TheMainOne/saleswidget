const Benefits = () => {
  const benefits = [
    {
      stat: "+20-40%",
      label: "More Qualified Leads",
      description: "Capture visitors who would have left without converting"
    },
    {
      stat: "<2s",
      label: "Response Time", 
      description: "Instant answers keep prospects engaged and interested"
    },
    {
      stat: "1-line",
      label: "Easy Install",
      description: "Add to any website in minutes, no coding required"
    }
  ];

  return (
    <section className="py-24 px-6 bg-gradient-to-r from-purple-accent/5 to-accent/5">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center space-y-6 mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground">
            Real Impact for Your Business
          </h2>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            See measurable results from day one with AI-powered sales assistance
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((benefit) => (
            <div 
              key={benefit.label}
              className="text-center group"
            >
              <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 group-hover:-translate-y-2">
                <div className="text-5xl lg:text-6xl font-bold text-purple-accent mb-4">
                  {benefit.stat}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{benefit.label}</h3>
                <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Benefits;