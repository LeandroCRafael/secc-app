import { UploadPreview } from "@/features/imports/upload-preview";
export const metadata = { title: "Importações" };
export default function ImportsPage() { return <><header className="admin-title"><p className="eyebrow">Arquivos não confiáveis</p><h1>Validar antes de armazenar ou mapear.</h1><p className="lede">Esta prévia local verifica extensão, MIME, tamanho e assinatura. Não persiste nem publica o arquivo.</p></header><UploadPreview /></>; }
