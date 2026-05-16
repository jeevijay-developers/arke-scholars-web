import { ShoppingBag, Star, Clock, Search, Loader2, GraduationCap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useCourses } from "@/hooks/useCourses";

const StorePage = () => {
  const [search, setSearch] = useState("");
  const { courses, loading } = useCourses();
  const filtered = courses.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subject.toLowerCase().includes(search.toLowerCase()) ||
    c.educator_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-primary via-accent to-secondary p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <ShoppingBag className="h-7 w-7" />
          <h1 className="text-2xl font-black font-display">Course Store</h1>
        </div>
        <p className="text-white/90 text-sm">Enroll in courses, test series, and mentorship programs</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search courses..."
          className="w-full rounded-xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
        />
      </div>

      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">No courses found</p>
          <p className="mt-1 text-xs text-muted-foreground">Try a different search term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((course) => {
            const discount =
              course.original_price && course.original_price > course.price
                ? Math.round((1 - Number(course.price) / Number(course.original_price)) * 100)
                : 0;
            return (
              <Link
                key={course.id}
                to={`/courses/${course.slug}`}
                className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
              >
                <div className="h-28 bg-gradient-to-br from-primary to-accent p-4 flex flex-col justify-between">
                  {course.badge && (
                    <span className="self-start rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                      {course.badge}
                    </span>
                  )}
                  <h3 className="text-sm font-bold text-white leading-tight line-clamp-2">{course.name}</h3>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <p className="text-xs text-muted-foreground">{course.educator_name}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-semibold text-foreground">{Number(course.rating).toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">
                      · {(course.total_enrolled ?? 0).toLocaleString()} students
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {course.duration_hours} hrs · {course.total_lessons} lessons
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-3">
                    <span className="text-lg font-black text-foreground">
                      ₹{Number(course.price).toLocaleString()}
                    </span>
                    {!!course.original_price && course.original_price > course.price && (
                      <span className="text-xs text-muted-foreground line-through">
                        ₹{Number(course.original_price).toLocaleString()}
                      </span>
                    )}
                    {discount > 0 && (
                      <span className="text-xs font-bold text-secondary">{discount}% off</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StorePage;
