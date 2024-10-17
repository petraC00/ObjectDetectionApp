declare module 'assets' {
    export interface Asset {
      // Define your asset properties here
      name: string;
      type: string;
      // Add more properties as needed
    }
  
    // You can also declare functions or constants related to assets
    export function loadAsset(url: string): Promise<Asset>;
  }
  