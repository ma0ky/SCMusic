// Journal de l'app. En version publiée, rien n'est écrit : logcat est lisible par adb, les rapports
// de bug et les apps système, et les messages contiendraient des noms de fichiers (MASVS-STORAGE-2).
export function logWarn(context: string, ...details: unknown[]): void {
  if (__DEV__) console.warn(context, ...details);
}
