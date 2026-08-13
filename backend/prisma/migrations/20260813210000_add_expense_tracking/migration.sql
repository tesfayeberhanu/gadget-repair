ALTER TABLE "User"
ADD COLUMN "salary" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "rent" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "commission" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN "allowance" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD CONSTRAINT "User_salary_check" CHECK ("salary" >= 0),
ADD CONSTRAINT "User_rent_check" CHECK ("rent" >= 0),
ADD CONSTRAINT "User_commission_check" CHECK ("commission" >= 0),
ADD CONSTRAINT "User_allowance_check" CHECK ("allowance" >= 0);

CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "expenseDate" DATE NOT NULL,
  "notes" TEXT,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Expense_amount_check" CHECK ("amount" > 0)
);

CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_recordedById_fkey"
FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
