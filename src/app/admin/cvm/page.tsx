import { requireRole } from "@/lib/auth/server";
import { searchCvmCompanies, type CvmCompany } from "@/lib/cvm/client";
import { PostgresOperationalRepository } from "@/lib/database/postgres-operational-repository";
import { collectCvmDfpAction } from "./actions";

export const metadata = { title: "Pesquisa CVM" };
export const dynamic = "force-dynamic";

type Search = { companyId?: string; q?: string; message?: string };

export default async function CvmPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireRole("admin");
  const search = await searchParams;
  let companies;
  try { companies = await new PostgresOperationalRepository().listCompanies(); }
  catch { return <><header className="admin-title"><p className="eyebrow">Conector CVM</p><h1>Banco local indisponível.</h1></header><p className="notice">Inicie o Docker antes de pesquisar.</p></>; }
  const selected = companies.find((company) => company.id === search.companyId) ?? companies[0];
  let results: CvmCompany[] = [];
  let searchError = "";
  if (search.q?.trim()) {
    try { results = await searchCvmCompanies(search.q); }
    catch (error) { searchError = error instanceof Error ? error.message : "A CVM não respondeu."; }
  }
  const defaultYear = Math.min(new Date().getFullYear() - 1, selected?.collectionEndYear ?? selected?.eventYear ?? new Date().getFullYear() - 1);

  return <>
    <header className="admin-title">
      <p className="eyebrow">Fonte oficial · cadastro e DFP</p>
      <h1>Pesquisar, vincular e coletar na CVM.</h1>
      <p className="lede">Confirme a correspondência da empresa e escolha um exercício. Os dados encontrados entram como propostas em revisão, com fonte e conta contábil registradas.</p>
    </header>
    {search.message && <p className="notice" role="status">{search.message}</p>}
    <section className="card">
      <form className="form-grid" method="get">
        <label>Empresa da planilha<select name="companyId" defaultValue={selected?.id}>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label>Nome, CNPJ ou código CVM<input name="q" defaultValue={search.q ?? selected?.name ?? ""} required /></label>
        <div className="full actions"><button className="button" type="submit">Pesquisar no cadastro CVM</button></div>
      </form>
    </section>
    {searchError && <p className="notice" role="alert">{searchError}</p>}
    <section className="section">
      <div><p className="eyebrow">Resultados</p><h2>{results.length} correspondência(s)</h2></div>
      {results.length === 0 ? <p className="notice">Faça uma pesquisa e confirme a razão social correta antes da coleta.</p> : <div className="grid">{results.map((result) => <article className="card" key={`${result.cnpj}-${result.cvmCode}`}>
        <div className="split"><div><h3>{result.corporateName}</h3><p>{result.tradeName || "Sem nome comercial"}<br/>CNPJ <span className="mono">{result.cnpj}</span> · CVM <span className="mono">{result.cvmCode}</span><br/>{result.sector || "Setor não informado"} · {result.status}</p></div><span className="status available">Cadastro oficial</span></div>
        <form action={collectCvmDfpAction} className="inline-collection">
          <input name="companyId" type="hidden" value={selected?.id ?? ""}/><input name="cnpj" type="hidden" value={result.cnpj}/><input name="cvmCode" type="hidden" value={result.cvmCode}/><input name="corporateName" type="hidden" value={result.corporateName}/>
          <label>Exercício DFP<input name="year" type="number" min="2010" max={new Date().getFullYear()} defaultValue={defaultYear}/></label>
          <button className="button" type="submit" disabled={!selected}>Vincular e coletar DFP</button>
        </form>
      </article>)}</div>}
    </section>
    <section className="section notice">Fonte: Portal de Dados Abertos da CVM. A correspondência societária e as contas derivadas exigem revisão humana antes da sincronização com a planilha.</section>
  </>;
}
