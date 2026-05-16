import QuestionBankPanel from "@/components/QuestionBankPanel";

const TeacherQuestionBankPage = () => {
  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      <div className="px-4 md:px-6 xl:px-10 pt-4 pb-2">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Question Bank</h1>
        <p className="text-sm text-muted-foreground mt-1">Build a reusable library of questions and drag them into any test.</p>
      </div>
      <div className="flex-1 min-h-0 px-4 md:px-6 xl:px-10 pb-4">
        <div className="h-full rounded-2xl border border-border bg-card overflow-hidden">
          <QuestionBankPanel manage />
        </div>
      </div>
    </div>
  );
};

export default TeacherQuestionBankPage;
