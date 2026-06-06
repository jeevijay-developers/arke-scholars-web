// Marquee of student testimonials. Names/quotes are representative samples —
// swap with real student photos when available. Avatars use a name-initial
// generator so they look real and stay easy to replace.
// Flat styling: solid borders, no gradients, no shadows.
type Testimonial = {
  image: string;
  name: string;
  result: string;
  quote: string;
};

const avatar = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0F172A&color=F97316&bold=true&size=96`;

const testimonials: Testimonial[] = [
  {
    name: "Aditya Sharma",
    result: "JEE Advanced · AIR 412",
    quote: "The live classes and instant doubt support kept me on track. I finally understood mechanics the way Sir explained it — that AIR is because of ARKE.",
    image: avatar("Aditya Sharma"),
  },
  {
    name: "Sneha Reddy",
    result: "NEET · AIR 689",
    quote: "Biology used to scare me. The chapter-wise tests and analytics showed exactly where I was losing marks. My score jumped 120 points in three months.",
    image: avatar("Sneha Reddy"),
  },
  {
    name: "Rohan Iyer",
    result: "JEE Main · 99.2 %ile",
    quote: "Recorded lectures were a lifesaver during board exams. I could revise a full chapter the night before a test. The mentors genuinely care about your progress.",
    image: avatar("Rohan Iyer"),
  },
  {
    name: "Ananya Gupta",
    result: "NEET · AIR 1,204",
    quote: "Coming from a small town, I never thought I'd get this quality of teaching online. The doubt sessions at 11 PM before exams were a blessing.",
    image: avatar("Ananya Gupta"),
  },
  {
    name: "Karthik Nair",
    result: "Foundation · Class 10",
    quote: "I joined in class 9 and my concepts in Physics and Maths are rock solid now. Olympiad prep here is far ahead of my school syllabus.",
    image: avatar("Karthik Nair"),
  },
  {
    name: "Priya Singh",
    result: "JEE Advanced · AIR 957",
    quote: "The weekly mock tests felt exactly like the real exam. By the time JEE came, I had zero exam-day nerves. Forever grateful to the ARKE team.",
    image: avatar("Priya Singh"),
  },
];

const TestimonialCard = ({ card }: { card: Testimonial }) => (
  <div className="p-5 rounded-2xl mx-3 border border-border bg-card w-72 shrink-0">
    <div className="flex items-center gap-3">
      <img className="size-11 rounded-full object-cover" src={card.image} alt={card.name} />
      <div className="flex flex-col">
        <p className="text-sm font-bold text-foreground">{card.name}</p>
        <span className="text-xs font-semibold text-muted-foreground">{card.result}</span>
      </div>
    </div>
    <p className="text-sm pt-4 text-muted-foreground leading-relaxed">{card.quote}</p>
  </div>
);

const MarqueeTestimonials = () => {
  return (
    <>
      <style>{`
        @keyframes marqueeScroll {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .marquee-inner { animation: marqueeScroll 25s linear infinite; }
        .marquee-reverse { animation-direction: reverse; }
        @media (prefers-reduced-motion: reduce) {
          .marquee-inner { animation: none; }
        }
      `}</style>

      <div className="marquee-row w-full mx-auto max-w-5xl overflow-hidden relative">
        <div className="marquee-inner flex transform-gpu min-w-[200%] py-5">
          {[...testimonials, ...testimonials].map((card, index) => (
            <TestimonialCard key={index} card={card} />
          ))}
        </div>
      </div>

      <div className="marquee-row w-full mx-auto max-w-5xl overflow-hidden relative">
        <div className="marquee-inner marquee-reverse flex transform-gpu min-w-[200%] py-5">
          {[...testimonials, ...testimonials].map((card, index) => (
            <TestimonialCard key={index} card={card} />
          ))}
        </div>
      </div>
    </>
  );
};

export default MarqueeTestimonials;
