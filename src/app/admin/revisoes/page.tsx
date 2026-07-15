import { ReviewFlow } from "@/features/review/review-flow";
export const metadata = { title: "Revisões" };
export default function ReviewsPage() { return <><header className="admin-title"><p className="eyebrow">Fundação vertical</p><h1>Da proposta à prévia pública, com controles separados.</h1><p className="lede">Execute o cenário fictício e confirme auditoria, filtro de publicação, conflito de versão e repetição de lote.</p></header><ReviewFlow /></>; }
