declare module 'adm-zip' {
  interface AdmZipEntry {
    entryName: string;
    isDirectory: boolean;
    getData(): Buffer;
  }

  class AdmZip {
    constructor(path?: string);
    addLocalFile(path: string, zipPath?: string): void;
    addFile(entryName: string, content: Buffer, comment?: string): void;
    writeZip(target?: string): void;
    getEntries(): AdmZipEntry[];
    extractAllTo(targetPath: string, overwrite?: boolean): void;
  }

  export default AdmZip;
  export { AdmZipEntry };
}
