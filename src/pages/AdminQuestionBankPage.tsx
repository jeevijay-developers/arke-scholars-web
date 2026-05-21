import { Library } from "lucide-react";
import QuestionBankPanel from "@/components/QuestionBankPanel";

const AdminQuestionBankPage = () => {
  return (
    <div className="space-y-4 m-2">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2">
          <Library className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Question Bank</h1>
          <p className="text-xs text-muted-foreground">
            Author and manage questions reusable across tests. Supports LaTeX math and chemistry equations.
          </p>
        </div>
      </div>

      <div className="rounded-2xl m-2 border border-border bg-card overflow-hidden h-[calc(100vh-180px)]">
        <QuestionBankPanel manage tableView />
      </div>
    </div>
  );
};

export default AdminQuestionBankPage;
