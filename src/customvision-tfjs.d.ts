declare module '@microsoft/customvision-tfjs' {
    export class ObjectDetectionModel {
      public loadModelAsync(modelUrl: string): Promise<void>;
      public executeAsync(input: HTMLVideoElement | HTMLImageElement): Promise<any>;
    }
  }
  