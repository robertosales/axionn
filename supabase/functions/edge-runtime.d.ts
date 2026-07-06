declare module "https://esm.sh/jszip@3.10.1" {
  interface ZipTextFile {
    async(type: "text"): Promise<string>;
  }

  interface ZipArchive {
    file(path: string): ZipTextFile | null;
  }

  interface JSZipStatic {
    loadAsync(data: Uint8Array): Promise<ZipArchive>;
  }

  const JSZip: JSZipStatic;
  export default JSZip;
}
