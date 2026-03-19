declare module "html-to-docx" {
  function HTMLtoDOCX(
    html: string,
    headerHTML?: string,
    options?: Record<string, unknown>
  ): Promise<Buffer>;
  export default HTMLtoDOCX;
}
