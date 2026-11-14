export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    schoolId: user.schoolId,
    createdAt: user.createdAt,
  };
}
