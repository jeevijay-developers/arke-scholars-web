import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Flame, Mail, Eye, EyeOff, Phone, User, MapPin, Check, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoLight from "@/assets/arke-logo-light.png";

// Keys are lowercase for matching; values are [displayName, state]
const CITY_STATE_MAP: { [key: string]: [string, string] } = {
  // Rajasthan
  "jaipur": ["Jaipur", "Rajasthan"],
  "kota": ["Kota", "Rajasthan"],
  "jodhpur": ["Jodhpur", "Rajasthan"],
  "udaipur": ["Udaipur", "Rajasthan"],
  "ajmer": ["Ajmer", "Rajasthan"],
  "bikaner": ["Bikaner", "Rajasthan"],
  "alwar": ["Alwar", "Rajasthan"],
  "sikar": ["Sikar", "Rajasthan"],
  "sri ganganagar": ["Sri Ganganagar", "Rajasthan"],
  "bharatpur": ["Bharatpur", "Rajasthan"],
  "pali": ["Pali", "Rajasthan"],
  "pushkar": ["Pushkar", "Rajasthan"],
  "bhilwara": ["Bhilwara", "Rajasthan"],
  "chittorgarh": ["Chittorgarh", "Rajasthan"],
  "dungarpur": ["Dungarpur", "Rajasthan"],
  // Delhi
  "delhi": ["Delhi", "Delhi"],
  "new delhi": ["New Delhi", "Delhi"],
  // Haryana
  "gurugram": ["Gurugram", "Haryana"],
  "gurgaon": ["Gurgaon", "Haryana"],
  "faridabad": ["Faridabad", "Haryana"],
  "hisar": ["Hisar", "Haryana"],
  "rohtak": ["Rohtak", "Haryana"],
  "ambala": ["Ambala", "Haryana"],
  "karnal": ["Karnal", "Haryana"],
  "panipat": ["Panipat", "Haryana"],
  "sonipat": ["Sonipat", "Haryana"],
  "panchkula": ["Panchkula", "Haryana"],
  "rewari": ["Rewari", "Haryana"],
  "yamunanagar": ["Yamunanagar", "Haryana"],
  "bhiwani": ["Bhiwani", "Haryana"],
  "kurukshetra": ["Kurukshetra", "Haryana"],
  // Uttar Pradesh
  "noida": ["Noida", "Uttar Pradesh"],
  "greater noida": ["Greater Noida", "Uttar Pradesh"],
  "lucknow": ["Lucknow", "Uttar Pradesh"],
  "kanpur": ["Kanpur", "Uttar Pradesh"],
  "varanasi": ["Varanasi", "Uttar Pradesh"],
  "agra": ["Agra", "Uttar Pradesh"],
  "meerut": ["Meerut", "Uttar Pradesh"],
  "allahabad": ["Allahabad", "Uttar Pradesh"],
  "prayagraj": ["Prayagraj", "Uttar Pradesh"],
  "ghaziabad": ["Ghaziabad", "Uttar Pradesh"],
  "mathura": ["Mathura", "Uttar Pradesh"],
  "aligarh": ["Aligarh", "Uttar Pradesh"],
  "bareilly": ["Bareilly", "Uttar Pradesh"],
  "moradabad": ["Moradabad", "Uttar Pradesh"],
  "gorakhpur": ["Gorakhpur", "Uttar Pradesh"],
  "firozabad": ["Firozabad", "Uttar Pradesh"],
  "jhansi": ["Jhansi", "Uttar Pradesh"],
  "muzaffarnagar": ["Muzaffarnagar", "Uttar Pradesh"],
  "saharanpur": ["Saharanpur", "Uttar Pradesh"],
  // Maharashtra
  "mumbai": ["Mumbai", "Maharashtra"],
  "pune": ["Pune", "Maharashtra"],
  "nagpur": ["Nagpur", "Maharashtra"],
  "aurangabad": ["Aurangabad", "Maharashtra"],
  "nashik": ["Nashik", "Maharashtra"],
  "thane": ["Thane", "Maharashtra"],
  "navi mumbai": ["Navi Mumbai", "Maharashtra"],
  "solapur": ["Solapur", "Maharashtra"],
  "kolhapur": ["Kolhapur", "Maharashtra"],
  "amravati": ["Amravati", "Maharashtra"],
  "nanded": ["Nanded", "Maharashtra"],
  "sangli": ["Sangli", "Maharashtra"],
  "satara": ["Satara", "Maharashtra"],
  "latur": ["Latur", "Maharashtra"],
  "akola": ["Akola", "Maharashtra"],
  "jalgaon": ["Jalgaon", "Maharashtra"],
  // Gujarat
  "ahmedabad": ["Ahmedabad", "Gujarat"],
  "surat": ["Surat", "Gujarat"],
  "vadodara": ["Vadodara", "Gujarat"],
  "rajkot": ["Rajkot", "Gujarat"],
  "gandhinagar": ["Gandhinagar", "Gujarat"],
  "bhavnagar": ["Bhavnagar", "Gujarat"],
  "jamnagar": ["Jamnagar", "Gujarat"],
  "anand": ["Anand", "Gujarat"],
  "nadiad": ["Nadiad", "Gujarat"],
  "bharuch": ["Bharuch", "Gujarat"],
  "mehsana": ["Mehsana", "Gujarat"],
  // Madhya Pradesh
  "bhopal": ["Bhopal", "Madhya Pradesh"],
  "indore": ["Indore", "Madhya Pradesh"],
  "gwalior": ["Gwalior", "Madhya Pradesh"],
  "jabalpur": ["Jabalpur", "Madhya Pradesh"],
  "ujjain": ["Ujjain", "Madhya Pradesh"],
  "sagar": ["Sagar", "Madhya Pradesh"],
  "rewa": ["Rewa", "Madhya Pradesh"],
  "satna": ["Satna", "Madhya Pradesh"],
  "dewas": ["Dewas", "Madhya Pradesh"],
  "ratlam": ["Ratlam", "Madhya Pradesh"],
  "chhindwara": ["Chhindwara", "Madhya Pradesh"],
  // Telangana
  "hyderabad": ["Hyderabad", "Telangana"],
  "warangal": ["Warangal", "Telangana"],
  "nizamabad": ["Nizamabad", "Telangana"],
  "karimnagar": ["Karimnagar", "Telangana"],
  "khammam": ["Khammam", "Telangana"],
  "secunderabad": ["Secunderabad", "Telangana"],
  // Andhra Pradesh
  "vijayawada": ["Vijayawada", "Andhra Pradesh"],
  "visakhapatnam": ["Visakhapatnam", "Andhra Pradesh"],
  "vizag": ["Vizag", "Andhra Pradesh"],
  "tirupati": ["Tirupati", "Andhra Pradesh"],
  "guntur": ["Guntur", "Andhra Pradesh"],
  "nellore": ["Nellore", "Andhra Pradesh"],
  "kurnool": ["Kurnool", "Andhra Pradesh"],
  "rajahmundry": ["Rajahmundry", "Andhra Pradesh"],
  // Karnataka
  "bangalore": ["Bangalore", "Karnataka"],
  "bengaluru": ["Bengaluru", "Karnataka"],
  "mysore": ["Mysore", "Karnataka"],
  "mysuru": ["Mysuru", "Karnataka"],
  "mangalore": ["Mangalore", "Karnataka"],
  "mangaluru": ["Mangaluru", "Karnataka"],
  "hubli": ["Hubli", "Karnataka"],
  "dharwad": ["Dharwad", "Karnataka"],
  "belagavi": ["Belagavi", "Karnataka"],
  "belgaum": ["Belgaum", "Karnataka"],
  "davangere": ["Davangere", "Karnataka"],
  "tumkur": ["Tumkur", "Karnataka"],
  "ballari": ["Ballari", "Karnataka"],
  "shivamogga": ["Shivamogga", "Karnataka"],
  // Tamil Nadu
  "chennai": ["Chennai", "Tamil Nadu"],
  "coimbatore": ["Coimbatore", "Tamil Nadu"],
  "madurai": ["Madurai", "Tamil Nadu"],
  "tiruchirappalli": ["Tiruchirappalli", "Tamil Nadu"],
  "trichy": ["Trichy", "Tamil Nadu"],
  "salem": ["Salem", "Tamil Nadu"],
  "tirunelveli": ["Tirunelveli", "Tamil Nadu"],
  "vellore": ["Vellore", "Tamil Nadu"],
  "erode": ["Erode", "Tamil Nadu"],
  "tiruppur": ["Tiruppur", "Tamil Nadu"],
  "dindigul": ["Dindigul", "Tamil Nadu"],
  // Kerala
  "thiruvananthapuram": ["Thiruvananthapuram", "Kerala"],
  "trivandrum": ["Trivandrum", "Kerala"],
  "kochi": ["Kochi", "Kerala"],
  "cochin": ["Cochin", "Kerala"],
  "kozhikode": ["Kozhikode", "Kerala"],
  "calicut": ["Calicut", "Kerala"],
  "thrissur": ["Thrissur", "Kerala"],
  "kollam": ["Kollam", "Kerala"],
  "kannur": ["Kannur", "Kerala"],
  "palakkad": ["Palakkad", "Kerala"],
  "malappuram": ["Malappuram", "Kerala"],
  // West Bengal
  "kolkata": ["Kolkata", "West Bengal"],
  "siliguri": ["Siliguri", "West Bengal"],
  "asansol": ["Asansol", "West Bengal"],
  "durgapur": ["Durgapur", "West Bengal"],
  "howrah": ["Howrah", "West Bengal"],
  "bardhaman": ["Bardhaman", "West Bengal"],
  // Bihar
  "patna": ["Patna", "Bihar"],
  "gaya": ["Gaya", "Bihar"],
  "muzaffarpur": ["Muzaffarpur", "Bihar"],
  "bhagalpur": ["Bhagalpur", "Bihar"],
  "darbhanga": ["Darbhanga", "Bihar"],
  "purnia": ["Purnia", "Bihar"],
  // Jharkhand
  "ranchi": ["Ranchi", "Jharkhand"],
  "jamshedpur": ["Jamshedpur", "Jharkhand"],
  "dhanbad": ["Dhanbad", "Jharkhand"],
  "bokaro": ["Bokaro", "Jharkhand"],
  // Odisha
  "bhubaneswar": ["Bhubaneswar", "Odisha"],
  "cuttack": ["Cuttack", "Odisha"],
  "rourkela": ["Rourkela", "Odisha"],
  "sambalpur": ["Sambalpur", "Odisha"],
  // Punjab
  "ludhiana": ["Ludhiana", "Punjab"],
  "amritsar": ["Amritsar", "Punjab"],
  "jalandhar": ["Jalandhar", "Punjab"],
  "patiala": ["Patiala", "Punjab"],
  "bathinda": ["Bathinda", "Punjab"],
  "pathankot": ["Pathankot", "Punjab"],
  "mohali": ["Mohali", "Punjab"],
  // Chandigarh (UT)
  "chandigarh": ["Chandigarh", "Chandigarh"],
  // Himachal Pradesh
  "shimla": ["Shimla", "Himachal Pradesh"],
  "mandi": ["Mandi", "Himachal Pradesh"],
  "solan": ["Solan", "Himachal Pradesh"],
  "dharamsala": ["Dharamsala", "Himachal Pradesh"],
  "manali": ["Manali", "Himachal Pradesh"],
  // Uttarakhand
  "dehradun": ["Dehradun", "Uttarakhand"],
  "haridwar": ["Haridwar", "Uttarakhand"],
  "roorkee": ["Roorkee", "Uttarakhand"],
  "haldwani": ["Haldwani", "Uttarakhand"],
  "rishikesh": ["Rishikesh", "Uttarakhand"],
  "nainital": ["Nainital", "Uttarakhand"],
  // Chhattisgarh
  "raipur": ["Raipur", "Chhattisgarh"],
  "bhilai": ["Bhilai", "Chhattisgarh"],
  "durg": ["Durg", "Chhattisgarh"],
  "bilaspur": ["Bilaspur", "Chhattisgarh"],
  // Assam
  "guwahati": ["Guwahati", "Assam"],
  "silchar": ["Silchar", "Assam"],
  "dibrugarh": ["Dibrugarh", "Assam"],
  "jorhat": ["Jorhat", "Assam"],
  // Goa
  "panaji": ["Panaji", "Goa"],
  "margao": ["Margao", "Goa"],
  "vasco da gama": ["Vasco da Gama", "Goa"],
  // Jammu & Kashmir
  "srinagar": ["Srinagar", "Jammu & Kashmir"],
  "jammu": ["Jammu", "Jammu & Kashmir"],
  // UAE
  "dubai": ["Dubai", "Dubai"],
  "sharjah": ["Sharjah", "Sharjah"],
  "abu dhabi": ["Abu Dhabi", "Abu Dhabi"],
  "ajman": ["Ajman", "Ajman"],
  "ras al khaimah": ["Ras Al Khaimah", "Ras Al Khaimah"],
  "umm al quwain": ["Umm Al Quwain", "Umm Al Quwain"],
  "fujairah": ["Fujairah", "Fujairah"],
  "al ain": ["Al Ain", "Abu Dhabi"],
};

const SignupPage = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error("Could not sign up with Google. Please try again.");
    }
    // Browser will redirect to Google on success
  };
  const [form, setForm] = useState({
    full_name: "",
    countryCode: "+91",
    phone: "",
    email: "",
    password: "",
    target_exam: "IIT JEE",
    class_level: "Class 6",
    city: "",
    state: "",
    country: "India",
  });
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const update = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));

    if (k === "city") {
      if (v.length > 0) {
        const suggestions = Object.keys(CITY_STATE_MAP).filter((city) =>
          city.toLowerCase().startsWith(v.toLowerCase())
        );
        setCitySuggestions(suggestions);
        setShowSuggestions(true);
      } else {
        setCitySuggestions([]);
        setShowSuggestions(false);
      }
    }
  };

  const selectCity = (key: string) => {
    const entry = CITY_STATE_MAP[key];
    setForm((f) => ({ ...f, city: entry[0], state: entry[1] }));
    setCitySuggestions([]);
    setShowSuggestions(false);
  };

  const handleSignup = async () => {
    if (!form.full_name || !form.email || !form.password) {
      toast.error("Name, email and password are required");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    const redirectUrl = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: form.full_name,
          phone: `${form.countryCode}${form.phone}`,
          target_exam: form.target_exam,
          class_level: form.class_level,
          city: form.city,
          state: form.state,
          country: form.country,
        },
      },
    });

    setSubmitting(false);

    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        toast.error("An account with this email already exists. Please log in.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    toast.success("Verification email sent! Check your inbox.");
    navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel */}
      <div className="hidden w-[60%] grid-texture p-12 lg:flex lg:flex-col lg:justify-center" style={{ background: "linear-gradient(135deg, hsl(222 47% 11%) 0%, hsl(222 47% 18%) 50%, hsl(222 47% 15%) 100%)" }}>
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <img src={logoLight} alt="ARKE Logo" className="h-14 rounded-xl" />
          </div>
          <div className="space-y-5 mt-12">
            {["Live classes from top educators", "JEE/NEET test series with rank", "AI doubt solver — available 24/7"].map((t) => (
              <div key={t} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/30">
                  <Check className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-medium text-white">{t}</span>
              </div>
            ))}
          </div>
          <p className="mt-12 text-sm text-white/85">Join 50,000+ students already learning</p>
          <Sparkles className="mt-8 h-6 w-6 text-accent animate-pulse" />
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex flex-1 items-center justify-center bg-card p-8 overflow-y-auto">
        <div className="w-full max-w-sm">
          <Link to="/" className="inline-flex items-center gap-1.5 mb-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <h2 className="text-2xl font-black font-display text-foreground">Create Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">Start your preparation journey</p>

          <button
            onClick={handleGoogleSignUp}
            disabled={googleLoading}
            className="mt-5 w-full rounded-lg border border-border py-3 text-sm font-semibold text-foreground hover:bg-background disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
            )}
            Continue with Google
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-2 text-xs text-muted-foreground">or sign up with email</span></div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} type="text" placeholder="Enter your name" className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Phone Number</label>
              <div className="mt-1 flex gap-2">
                <select value={form.countryCode} onChange={(e) => update("countryCode", e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground">
                  <option value="+91">IN +91</option>
                  <option value="+971">AE +971</option>
                </select>
                <input value={form.phone} onChange={(e) => update("phone", e.target.value)} type="tel" placeholder="Phone number" className="flex-1 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" placeholder="you@example.com" className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative mt-1">
                <input value={form.password} onChange={(e) => update("password", e.target.value)} type={showPassword ? "text" : "password"} placeholder="Min 8 characters" className="w-full rounded-lg border border-border bg-card py-2.5 px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Target Exam</label>
                <select value={form.target_exam} onChange={(e) => update("target_exam", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground">
                  <option>IIT JEE</option>
                  <option>NEET</option>
                  <option>Boards</option>
                  <option>JEE + NEET</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Class</label>
                <select value={form.class_level} onChange={(e) => update("class_level", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground">
                  <option>Class 6</option>
                  <option>Class 7</option>
                  <option>Class 8</option>
                  <option>Class 9</option>
                  <option>Class 10</option>
                  <option>Class 11</option>
                  <option>Class 12</option>
                  <option>Dropper</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">City</label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    onFocus={() => form.city.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    type="text"
                    placeholder="City"
                    className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  />
                  {showSuggestions && citySuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                      {citySuggestions.slice(0, 6).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectCity(key); }}
                          className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          {CITY_STATE_MAP[key][0]}
                          <span className="ml-1.5 text-xs text-muted-foreground">{CITY_STATE_MAP[key][1]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">State</label>
                <input
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                  type="text"
                  placeholder="State"
                  className="mt-1 w-full rounded-lg border border-border bg-card py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Country</label>
              <select value={form.country} onChange={(e) => update("country", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground">
                <option>India</option>
                <option>UAE</option>
              </select>
            </div>
            <button onClick={handleSignup} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating Account...</> : "Create Account"}
            </button>
          </div>

          <div className="mt-4 text-center">
            <span className="text-sm text-muted-foreground">Already have an account? </span>
            <Link to="/login" className="text-sm font-semibold text-primary hover:text-primary-dark">Login →</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
