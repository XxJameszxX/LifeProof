export class RelayerSDKLoader {
  private _url: string;
  constructor(url = "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs") {
    this._url = url;
  }

  public load(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).relayerSDK) return resolve();
      const script = document.createElement("script");
      script.src = this._url;
      script.type = "text/javascript";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load Relayer SDK from ${this._url}`));
      document.head.appendChild(script);
    });
  }
}





