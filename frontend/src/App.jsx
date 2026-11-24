import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { homeFor } from './lib/api.js';
import { ForgotPassword, Home, Login, Register, ResetPassword } from './pages/Public.jsx';
import { Shell } from './components/Shell.jsx';
import {
  LeaderboardPage,
  LessonDetail,
  LessonList,
  NoticesPage,
  ProfilePage,
  ProgressPage,
  QuizPage,
  StudentHome,
  TaskDetail,
  TaskList,
} from './pages/Student.jsx';
import { ReviewPage, TeachContent, TeachHome } from './pages/Teacher.jsx';
import { AdminHome } from './pages/Admin.jsx';
import { ActivitiesPage, ActivityPage } from './pages/Activities.jsx';

function RequireAuth({ roles }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="status" role="status">Loading your account…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Shell links={linksFor(user.role)} />;
}

function linksFor(role) {
  if (role === 'ADMIN') {
    return [
      { to: '/admin', label: 'Overview', end: true },
      { to: '/admin/people', label: 'People' },
      { to: '/admin/content', label: 'Content' },
      { to: '/admin/profile', label: 'Profile and data' },
    ];
  }
  if (role === 'TEACHER') {
    return [
      { to: '/teach', label: 'Overview', end: true },
      { to: '/teach/content', label: 'Lessons and tasks' },
      { to: '/teach/reviews', label: 'Reviews' },
      { to: '/teach/profile', label: 'Profile and data' },
    ];
  }
  return [
    { to: '/learn', label: 'Home', end: true },
    { to: '/learn/lessons', label: 'Lessons' },
    { to: '/learn/tasks', label: 'Tasks' },
    { to: '/learn/activities', label: 'Activities' },
    { to: '/learn/progress', label: 'Eco-points' },
    { to: '/learn/board', label: 'Leaderboard' },
    { to: '/learn/notices', label: 'Notices' },
    { to: '/learn/profile', label: 'Profile' },
  ];
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<RequireAuth roles={['STUDENT']} />}>
        <Route path="/learn" element={<StudentHome />} />
        <Route path="/learn/lessons" element={<LessonList />} />
        <Route path="/learn/lessons/:lessonId" element={<LessonDetail />} />
        <Route path="/learn/quizzes/:quizId" element={<QuizPage />} />
        <Route path="/learn/tasks" element={<TaskList />} />
        <Route path="/learn/tasks/:taskId" element={<TaskDetail />} />
        <Route path="/learn/activities" element={<ActivitiesPage />} />
        <Route path="/learn/activities/:activityId" element={<ActivityPage />} />
        <Route path="/learn/progress" element={<ProgressPage />} />
        <Route path="/learn/board" element={<LeaderboardPage />} />
        <Route path="/learn/notices" element={<NoticesPage />} />
        <Route path="/learn/profile" element={<ProfilePage />} />
      </Route>
      <Route element={<RequireAuth roles={['TEACHER']} />}>
        <Route path="/teach" element={<TeachHome />} />
        <Route path="/teach/content" element={<TeachContent />} />
        <Route path="/teach/reviews" element={<ReviewPage />} />
        <Route path="/teach/profile" element={<ProfilePage />} />
      </Route>
      <Route element={<RequireAuth roles={['ADMIN']} />}>
        <Route path="/admin" element={<AdminHome section="overview" />} />
        <Route path="/admin/people" element={<AdminHome section="people" />} />
        <Route path="/admin/content" element={<AdminHome section="content" />} />
        <Route path="/admin/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
