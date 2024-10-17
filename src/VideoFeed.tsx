import React, { useRef, useEffect, useState } from "react";
import videojs from "video.js";
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import "video.js/dist/video-js.css";

// Define constants and types
const threshold = 0.5; // Confidence threshold for displaying detections
const targetClasses = [0, 2]; // List of class IDs to show (based on your trained classes)

const classColors = {
  0: 'red',
  2: 'blue',
  3:'purple',
  4:'green',
  5:'pink',
  6:'black',
  7:'white',
  8:'orange',
  9:'brown',
  10:'pink',
  11:'gray'
};

interface VideoFeedProps {
  src: string;
}

interface VideoElementWithPlayer extends HTMLVideoElement {
  player?: ReturnType<typeof videojs>;
}

const VideoFeed: React.FC<VideoFeedProps> = ({ src }) => {
  const videoRef = useRef<VideoElementWithPlayer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [player, setPlayer] = useState<ReturnType<typeof videojs>>();
  const [model, setModel] = useState<tf.GraphModel | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout>();
  const [hasDetections, setHasDetections] = useState<boolean>(false);

  // Load the TensorFlow.js model
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        console.log('TensorFlow.js backend set and ready');

        const modelJson = '/model/model.json'; // Update path as needed
        const loadedModel = await tf.loadGraphModel(modelJson);

        setModel(loadedModel);
        console.log('Model loaded successfully');
      } catch (error) {
        console.error('Error loading model: ', error);
      }
    };

    loadModel();
  }, []);

  // Initialize the Video.js player
  useEffect(() => {
    if (!player && videoRef.current) {
      const videoElement = videoRef.current;

      if (!videoElement.player) {
        setPlayer(
          videojs(videoElement, {}, () => {
            console.log("Player is ready");
          })
        );
      }
    }

    return () => {
      if (player) {
        player.dispose();
        setPlayer(undefined);
      }
    };
  }, [player]);

  // Capture frame, predict objects, and draw bounding boxes
  useEffect(() => {
    if (model && videoRef.current && canvasRef.current) {
      const videoElement = videoRef.current;
      const canvasElement = canvasRef.current;
      const context = canvasElement.getContext('2d');

      if (!context) {
        throw new Error('Failed to get canvas context');
      }

      const detectFrame = async () => {
        if (videoElement.paused || videoElement.ended) return;
      
        // Set canvas size to video size
        videoElement.width = 640;
        videoElement.height = 640;
        canvasElement.width = 640;
        canvasElement.height = 640;
      
        // Draw video frame to canvas
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
      
        // Use tf.tidy to automatically manage tensor memory
        tf.tidy(() => {
          const imageTensor = tf.browser.fromPixels(canvasElement)
            .resizeBilinear([640, 640])
            .toFloat()
            .expandDims(0)
            .div(tf.scalar(255.0)); // Normalize image pixel values to [0, 1]
      
          // Run object detection
          const predictions = model.execute(imageTensor) as tf.Tensor;
          const predictionArray = predictions.arraySync() as number[][][];

          const output = predictionArray[0];
      
          // Clear previous drawings
          context.clearRect(0, 0, canvasElement.width, canvasElement.height);
          context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
      
          // Parse and draw bounding boxes
          const detectionResults: { x: number, y: number, width: number, height: number, score: number, classId: number }[] = [];
      
          output.forEach((item: number[]) => {
            const score = item[4]; // Confidence score
            if (score >= threshold) {
              const classId = item[5]; // Class ID or class score
      
               // Filter by target classes
                const xCenter = item[0]; // x_center (adjust based on actual indices)
                const yCenter = item[1]; // y_center (adjust based on actual indices)
                const width = item[2]; // width (adjust based on actual indices)
                const height = item[3]; // height (adjust based on actual indices)
      
                const x = xCenter - width / 2;
                const y = yCenter - height / 2;
      
                detectionResults.push({
                  x: x * canvasElement.width,
                  y: y * canvasElement.height,
                  width: width * canvasElement.width,
                  height: height * canvasElement.height,
                  score,
                  classId,
                });
              
            }
          });
      
          detectionResults.forEach(result => {
            context.beginPath();
            context.rect(result.x, result.y, result.width, result.height);
            context.lineWidth = 2;
            const color = classColors[result.classId as keyof typeof classColors] || 'yellow'; // Default color if classId is not in classColors
            context.strokeStyle = color;
            context.fillStyle = color;
            context.stroke();
            context.fillText(`(${(result.score * 100).toFixed(1)}%)`, result.x, result.y > 10 ? result.y - 5 : 10);
          });
      
          setHasDetections(detectionResults.length > 0);
        });
      
      };
      

      // Use requestAnimationFrame for smooth updates
      const intervalId = setInterval(() => {
        detectFrame();
      }, 100); // Adjust the interval as needed (e.g., 100ms for roughly 10fps)

      frameIntervalRef.current = intervalId;

      return () => {
        if (frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current);
        }
      };
    }
  }, [model]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <video
        className="video-js"
        ref={videoRef}
        controls
        style={{
          objectFit: "contain", // Ensure the video fills the container and is center-cropped
          objectPosition: "center",
          width: "640px",
          height: "640px"
        }}
      >
        <source src={src} type="application/x-mpegURL" />
      </video>
      <canvas
        ref={canvasRef}
        width="640"
        height="640"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "640px",
          height: "640px",
          backgroundColor: "transparent",
          pointerEvents: "none"
        }}
      />
    </div>
  );
};

export default VideoFeed;
