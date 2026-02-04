import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Shield, DollarSign } from "lucide-react";
import ContactDialog from "@/components/ContactDialog";

const FinalCTA = () => {
  const [contactOpen, setContactOpen] = useState(false);
  const [contactType, setContactType] = useState<"demo_request" | "general_inquiry" | "sales_question" | "signup">("signup");

  const handleContactClick = (type: "demo_request" | "general_inquiry" | "sales_question" | "signup") => {
    setContactType(type);
    setContactOpen(true);
  };

  return <section className="py-24 px-6 bg-gradient-to-r from-purple-accent to-accent">
      <div className="container mx-auto max-w-4xl text-center">
        <div className="space-y-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight">Ready to add an AI Sales Advisor 
to your site?</h2>
          
          <p className="text-xl lg:text-2xl text-white/90 leading-relaxed">
            Join hundreds of businesses already converting more visitors into customers
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
            <Button 
              size="lg" 
              className="bg-white text-purple-accent hover:bg-white/90 font-semibold px-12 py-6 text-xl shadow-lg transition-all duration-300 hover:shadow-xl h-16"
              onClick={() => handleContactClick("signup")}
            >
              Get Started Free
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="border-2 border-white text-white bg-white/10 backdrop-blur-sm hover:bg-white hover:text-purple-accent font-semibold px-12 py-6 text-xl transition-all duration-300 h-16"
              onClick={() => handleContactClick("demo_request")}
            >
              Book a Demo
            </Button>
          </div>

          <div className="pt-8 flex flex-wrap justify-center gap-8 text-white/80">
            <div className="flex items-center gap-2">
              <Zap size={20} strokeWidth={1.5} />
              <span>5-minute setup</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={20} strokeWidth={1.5} />
              <span>GDPR compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign size={20} strokeWidth={1.5} />
              <span>30-day free trial</span>
            </div>
          </div>
        </div>
      </div>
      <ContactDialog isOpen={contactOpen} onOpenChange={setContactOpen} defaultType={contactType} />
    </section>;
};
export default FinalCTA;