import React, { useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "./pages/LandingPage";
import CareerPage from "./pages/CareerPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ForceChangePasswordPage from "./pages/ForceChangePasswordPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import UnsubscribePage from "./pages/UnsubscribePage";
import StudentLayout from "./components/StudentLayout";
import TeacherLayout from "./components/TeacherLayout";
import AdminLayout from "./components/AdminLayout";
import StudentDashboard from "./pages/StudentDashboard";
import TestListPage from "./pages/TestListPage";
import TestTakingPage from "./pages/TestTakingPage";
import TestResultPage from "./pages/TestResultPage";
import TestSubjectBreakdownPage from "./pages/TestSubjectBreakdownPage";
import LiveClassRoomPage from "./pages/LiveClassRoomPage";
import LiveClassesListPage from "./pages/LiveClassesListPage";

import CompetePage from "./pages/CompetePage";
import DoubtPage from "./pages/DoubtPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CoursesPage from "./pages/CoursesPage";
import MyCoursesPage from "./pages/MyCoursesPage";
import FavouriteCoursesPage from "./pages/FavouriteCoursesPage";
import CourseDetailPage from "./pages/CourseDetailPage";
import LecturePlayerPage from "./pages/LecturePlayerPage";
import ProfilePage from "./pages/ProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import EducatorsPage from "./pages/EducatorsPage";
import SettingsPage from "./pages/SettingsPage";
import StorePage from "./pages/StorePage";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherDoubtQueuePage from "./pages/TeacherDoubtQueuePage";
import TeacherLiveClassesPage from "./pages/TeacherLiveClassesPage";
import TeacherLiveClassRoomPage from "./pages/TeacherLiveClassRoomPage";
import TeacherSettingsPage from "./pages/TeacherSettingsPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminStudentsPage from "./pages/AdminStudentsPage";
import AdminStudentReportsPage from "./pages/AdminStudentReportsPage";
import AdminMentorAssignmentsPage from "./pages/AdminMentorAssignmentsPage";
import AdminPaymentsPage from "./pages/AdminPaymentsPage";
import AdminNotificationsPage from "./pages/AdminNotificationsPage";
import AdminCoursesPage from "./pages/AdminCoursesPage";
import AdminStudentDetailPage from "./pages/AdminStudentDetailPage";
import CreateCoursePage from "./pages/CreateCoursePage";
import CreateTestPage from "./pages/CreateTestPage";
import AdminLiveClassesPage from "./pages/AdminLiveClassesPage";
import AdminTestsPage from "./pages/AdminTestsPage";
import AdminQuestionBankPage from "./pages/AdminQuestionBankPage";
import AdminCompeteQuestionsPage from "./pages/AdminCompeteQuestionsPage";
import AdminExamsPage from "./pages/AdminExamsPage";
import AdminCourseBannersPage from "./pages/AdminCourseBannersPage";
import AdminStaffRolesPage from "./pages/AdminStaffRolesPage";
import AdminModerationPage from "./pages/AdminModerationPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AdminEducatorApplicationsPage from "./pages/AdminEducatorApplicationsPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import StaffDashboardPage from "./pages/StaffDashboardPage";
import AdminEnquiriesPage from "./pages/AdminEnquiriesPage";
import AdminCourseContentPage from "./pages/AdminCourseContentPage";
import AdminReportsPage from "./pages/AdminReportsPage";
import AdminProfilePage from "./pages/AdminProfilePage";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicLayout from "./components/PublicLayout";
import TestsLandingPage from "./pages/TestsLandingPage";
import LiveClassesLandingPage from "./pages/LiveClassesLandingPage";
import PricingPage from "./pages/PricingPage";
import MentorshipPage from "./pages/MentorshipPage";
import AdmissionsPage from "./pages/AdmissionsPage";
import AssociationPage from "./pages/AssociationPage";
import AboutPage from "./pages/AboutPage";
import ContactPage from "./pages/ContactPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import AccessDeniedPage from "./pages/AccessDeniedPage";
import MentorLayout from "./components/MentorLayout";
import MentorDashboard from "./pages/MentorDashboard";
import MentorChatsPage from "./pages/MentorChatsPage";
import MentorPerformancePage from "./pages/MentorPerformancePage";
import MentorSettingsPage from "./pages/MentorSettingsPage";
import MentorStudentsPage from "./pages/MentorStudentsPage";
import MentorAnnouncementsPage from "./pages/MentorAnnouncementsPage";
import AdminMentorHandoversPage from "./pages/AdminMentorHandoversPage";
import AdminSchoolsPage from "./pages/AdminSchoolsPage";
import AdminUploadQuestionsPage from "./pages/AdminUploadQuestionsPage";
import AdminReviewQuestionsPage from "./pages/AdminReviewQuestionsPage";
import StudentMentorChatPage from "./pages/StudentMentorChatPage";
import BattleLobby from "./pages/BattleLobby";
import BattleRoom from "./pages/BattleRoom";
import BattleResult from "./pages/BattleResult";
import BattleLeaderboard from "./pages/BattleLeaderboard";
import { AuthProvider } from "./context/AuthContext";
import LeadManagerLayout from "./components/LeadManagerLayout";
import LeadManagerDashboardPage from "./pages/LeadManagerDashboardPage";
import NotFound from "./pages/NotFound";

function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search, document.title);
  }, [location]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
    },
  },
});

const App = () => (
<HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteTracker />
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/auth/change-password" element={<ForceChangePasswordPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/access-denied" element={<AccessDeniedPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />

            {/* Immersive full-screen pages (no sidebar/bottom nav) — students only */}
            <Route element={<ProtectedRoute allow={["student"]} />}>
              <Route path="/tests/:slug/take" element={<TestTakingPage />} />
              <Route path="/courses/:slug/learn" element={<LecturePlayerPage />} />
            </Route>

            {/* Public marketing pages (PublicLayout: own navbar + footer) */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/career" element={<CareerPage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/courses/:slug" element={<CourseDetailPage />} />
              <Route path="/tests" element={<TestsLandingPage />} />
              <Route path="/live-classes" element={<LiveClassesLandingPage />} />
              <Route path="/educators" element={<EducatorsPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/mentorship" element={<MentorshipPage />} />
              <Route path="/admissions" element={<AdmissionsPage />} />
              <Route path="/association" element={<AssociationPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsOfServicePage />} />
            </Route>

            {/* Legacy /store redirect */}
            <Route path="/store" element={<Navigate to="/explore-courses" replace />} />

            {/* Student layout — students only */}
            <Route element={<ProtectedRoute allow={["student"]} />}>
              <Route element={<StudentLayout />}>
                <Route path="/dashboard" element={<StudentDashboard />} />
                <Route path="/my-tests" element={<TestListPage />} />
                <Route path="/tests/:slug/result/:attemptId" element={<TestResultPage />} />
                <Route path="/tests/:slug/result/:attemptId/subject/:subject" element={<TestSubjectBreakdownPage />} />
                <Route path="/my-live-classes" element={<LiveClassesListPage />} />
                <Route path="/live-classes/:slug" element={<LiveClassRoomPage />} />
                
                <Route path="/compete" element={<CompetePage />} />
                <Route path="/battle" element={<BattleLobby />} />
                <Route path="/battle/room/:battleId" element={<BattleRoom />} />
                <Route path="/battle/result/:battleId" element={<BattleResult />} />
                <Route path="/battle/leaderboard" element={<BattleLeaderboard />} />
                <Route path="/doubts" element={<DoubtPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/my-courses" element={<MyCoursesPage />} />
                <Route path="/favourite-courses" element={<FavouriteCoursesPage />} />
                <Route path="/explore-courses" element={<StorePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/mentor-chat" element={<StudentMentorChatPage />} />
              </Route>
            </Route>

            {/* Teacher layout — teachers only. Per role restructure, teachers
                only handle live classes and assigned doubts. Everything else
                (courses, tests, students, analytics, question bank) lives in
                the admin portal. */}
            <Route element={<ProtectedRoute allow={["teacher"]} />}>
              <Route element={<TeacherLayout />}>
                <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
                <Route path="/teacher/live-classes" element={<TeacherLiveClassesPage />} />
                <Route path="/teacher/live-classes/:slug" element={<TeacherLiveClassRoomPage />} />
                <Route path="/teacher/doubts" element={<TeacherDoubtQueuePage />} />
                <Route path="/teacher/settings" element={<TeacherSettingsPage />} />
                {/* Legacy teacher URLs now redirect into the trimmed portal. */}
                <Route path="/teacher/courses" element={<Navigate to="/teacher/dashboard" replace />} />
                <Route path="/teacher/courses/create" element={<Navigate to="/teacher/dashboard" replace />} />
                <Route path="/teacher/tests/create" element={<Navigate to="/teacher/dashboard" replace />} />
                <Route path="/teacher/question-bank" element={<Navigate to="/teacher/dashboard" replace />} />
                <Route path="/teacher/students" element={<Navigate to="/teacher/dashboard" replace />} />
                <Route path="/teacher/analytics" element={<Navigate to="/teacher/dashboard" replace />} />
              </Route>
            </Route>

            {/* Mentor layout — mentors only */}
            <Route element={<ProtectedRoute allow={["mentor"]} />}>
              <Route element={<MentorLayout />}>
                <Route path="/mentor/dashboard" element={<MentorDashboard />} />
                <Route path="/mentor/students" element={<MentorStudentsPage />} />
                <Route path="/mentor/announcements" element={<MentorAnnouncementsPage />} />
                <Route path="/mentor/chats" element={<MentorChatsPage />} />
                <Route path="/mentor/performance" element={<MentorPerformancePage />} />
                <Route path="/mentor/settings" element={<MentorSettingsPage />} />
              </Route>
            </Route>

            {/* Lead Manager layout — lead_manager role only */}
            <Route element={<ProtectedRoute allow={["lead_manager"]} loginPath="/login" />}>
              <Route element={<LeadManagerLayout />}>
                <Route path="/lead-manager" element={<Navigate to="/lead-manager/dashboard" replace />} />
                <Route path="/lead-manager/dashboard" element={<LeadManagerDashboardPage />} />
                <Route path="/lead-manager/leads" element={<LeadManagerDashboardPage />} />
              </Route>
            </Route>

            {/* Staff auth */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Protected staff/admin pages */}
            <Route
              element={
                <ProtectedAdminRoute>
                  <AdminLayout />
                </ProtectedAdminRoute>
              }
            >
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<StaffDashboardPage />} />
              <Route path="/admin/educator-applications" element={<AdminEducatorApplicationsPage />} />
              <Route path="/admin/enquiries" element={<AdminEnquiriesPage />} />
              <Route path="/admin/course-content" element={<AdminCourseContentPage />} />
              <Route path="/admin/reports" element={<AdminReportsPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/students" element={<AdminStudentsPage />} />
              <Route path="/admin/students/:userId" element={<AdminStudentDetailPage />} />
              <Route path="/admin/student-reports" element={<AdminStudentReportsPage />} />
              <Route path="/admin/schools" element={<AdminSchoolsPage />} />
              <Route path="/admin/mentor-assignments" element={<AdminMentorAssignmentsPage />} />
              <Route path="/admin/mentor-handovers" element={<AdminMentorHandoversPage />} />
              <Route path="/admin/courses" element={<AdminCoursesPage />} />

              <Route path="/admin/courses/new" element={<CreateCoursePage />} />
              <Route path="/admin/courses/:courseId/edit" element={<CreateCoursePage />} />
              <Route path="/admin/live-classes" element={<AdminLiveClassesPage />} />
              <Route path="/admin/tests" element={<AdminTestsPage />} />
              <Route path="/admin/tests/new" element={<CreateTestPage />} />
              <Route path="/admin/tests/:slug/edit" element={<CreateTestPage />} />
              <Route path="/admin/question-bank" element={<AdminQuestionBankPage />} />
              <Route path="/admin/compete-questions" element={<AdminCompeteQuestionsPage />} />
              <Route path="/admin/exams" element={<AdminExamsPage />} />
              <Route path="/admin/course-banners" element={<AdminCourseBannersPage />} />
              <Route path="/admin/payments" element={<AdminPaymentsPage />} />
              <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
              <Route path="/admin/moderation" element={<AdminModerationPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
              <Route path="/admin/staff-roles" element={<AdminStaffRolesPage />} />
              <Route path="/admin/profile" element={<AdminProfilePage />} />
              <Route path="/admin/overview" element={<AdminDashboard />} />
              <Route path="/admin/upload-questions" element={<AdminUploadQuestionsPage />} />
              <Route path="/admin/review-questions/:paperId" element={<AdminReviewQuestionsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
</HelmetProvider>
);

export default App;
