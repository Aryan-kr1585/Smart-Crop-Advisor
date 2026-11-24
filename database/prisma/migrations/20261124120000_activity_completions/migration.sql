CREATE TABLE "ActivityCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityCompletion_userId_activityId_key" ON "ActivityCompletion"("userId", "activityId");
CREATE INDEX "ActivityCompletion_userId_completedAt_idx" ON "ActivityCompletion"("userId", "completedAt");
ALTER TABLE "ActivityCompletion" ADD CONSTRAINT "ActivityCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
