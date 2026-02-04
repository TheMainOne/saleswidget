const Footer = () => {
  return (
    <footer className="py-16 px-6 bg-graphite text-cream">
      <div className="container mx-auto max-w-7xl">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white">AI-Consultant Widget</h3>
            <p className="text-cream/80 leading-relaxed">
              Turn your website into a sales assistant with AI-powered conversations.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white">Product</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-cream/80 hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="text-cream/80 hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="text-cream/80 hover:text-white transition-colors">Demo</a></li>
              <li><a href="#" className="text-cream/80 hover:text-white transition-colors">API</a></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white">Support</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-cream/80 hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="text-cream/80 hover:text-white transition-colors">Help Center</a></li>
              <li><a href="#" className="text-cream/80 hover:text-white transition-colors">Contact</a></li>
              <li><a href="#" className="text-cream/80 hover:text-white transition-colors">Status</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-white">Legal</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-cream/80 hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-cream/80 hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="text-cream/80 hover:text-white transition-colors">GDPR</a></li>
              <li><a href="#" className="text-cream/80 hover:text-white transition-colors">Security</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-cream/20 mt-12 pt-8 text-center">
          <p className="text-cream/60">
            © 2025 AI-Consultant Widget. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;