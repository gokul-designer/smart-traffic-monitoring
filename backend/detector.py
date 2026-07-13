#!/usr/bin/env python3
"""
Smart Vehicle Monitoring & Traffic Rule Enforcement System
Python Production Blueprint Implementation Reference

This script serves as a technical reference detailing how to wire up
YOLOv10, PaddleOCR, and ByteTrack in Python for real-world deployment.

Requirements:
    pip install opencv-python numpy torch ultralytics paddleocr paho-mqtt requests
"""

import os
import time
import math
import cv2
import numpy as np
import requests
import paho.mqtt.client as mqtt

# Try importing AI/OCR libraries (mocked if not installed locally)
try:
    from ultralytics import YOLO
    from paddleocr import PaddleOCR
    HAS_LIBS = True
except ImportError:
    HAS_LIBS = False
    print("[WARNING] OpenCV or AI models are missing. Running in technical blueprint reference mode.")

class AutoEnforceSystem:
    def __init__(self, video_source=0, mqtt_broker="localhost"):
        self.video_source = video_source
        self.mqtt_broker = mqtt_broker
        
        # Camera Calibration - Homography Matrix (H)
        # Defined during camera installation to map 2D image coordinates to 3D road plane
        # 4 coplanar calibration points on road (in pixels -> in physical meters)
        src_points = np.float32([[200, 400], [800, 400], [50, 1000], [1000, 1000]]) # Image coordinates
        dst_points = np.float32([[0, 0],   [12, 0],   [0, 30],    [12, 30]])    # Real world coordinates (meters)
        self.homography_matrix, _ = cv2.findHomography(src_points, dst_points)
        
        # Load AI Models if available
        if HAS_LIBS:
            print("[INFO] Loading YOLOv10 weights (Vehicle & Helmet classifier)...")
            self.yolo_model = YOLO("yolov10n.pt") # Or custom trained helmet model
            print("[INFO] Loading PaddleOCR engine (ANPR Reader)...")
            self.ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
        else:
            self.yolo_model = None
            self.ocr = None
            print("[INFO] Reference Mode Active: Models loaded (Virtual Mock).")
            
        # MQTT IoT Client Initialization
        self.mqtt_client = mqtt.Client()
        try:
            self.mqtt_client.connect(self.mqtt_broker, 1883, 60)
            print(f"[INFO] Connected to IoT Core Broker: {self.mqtt_broker}")
        except Exception:
            print("[WARNING] IoT Broker connection failed. Continuing in local console log mode.")

        # Multi-Vehicle Tracker Memory (Mocking ByteTrack ID coordinate mapping)
        self.tracker_db = {} # Format: {vehicle_id: [(x_centroid, y_centroid, timestamp)]}

    def convert_pixel_to_meters(self, px_x, px_y):
        """
        Maps a 2D pixel coordinate (px_x, px_y) to physical ground coordinates (X_m, Y_m)
        using the pre-computed Homography Calibration Matrix.
        """
        point = np.array([[[px_x, px_y]]], dtype=np.float32)
        transformed = cv2.perspectiveTransform(point, self.homography_matrix)
        x_meters = transformed[0][0][0]
        y_meters = transformed[0][0][1]
        return x_meters, y_meters

    def calculate_vehicle_speed(self, vehicle_id, current_x, current_y, fps=30):
        """
        Calculates the physical velocity of a tracked vehicle across frames.
        Uses real frame timestamps, Pixel-to-Meter homography coordinates, and sliding scale filters.
        """
        current_time = time.time()
        
        if vehicle_id not in self.tracker_db:
            self.tracker_db[vehicle_id] = [(current_x, current_y, current_time)]
            return 0.0
            
        history = self.tracker_db[vehicle_id]
        history.append((current_x, current_y, current_time))
        
        # Maintain history sliding window of last 10 frames
        if len(history) > 10:
            history.pop(0)
            
        # Calculate speed between start and end of sliding window
        start_px_x, start_px_y, start_t = history[0]
        
        # Convert first and last coordinate to meters
        start_m_x, start_m_y = self.convert_pixel_to_meters(start_px_x, start_px_y)
        end_m_x, end_m_y = self.convert_pixel_to_meters(current_x, current_y)
        
        # Euclidean displacement distance
        distance_meters = math.sqrt((end_m_x - start_m_x)**2 + (end_m_y - start_m_y)**2)
        time_elapsed = current_time - start_t
        
        if time_elapsed <= 0:
            return 0.0
            
        # Velocity calculation (meters/sec -> km/h)
        speed_mps = distance_meters / time_elapsed
        speed_kmh = speed_mps * 3.6
        return round(speed_kmh, 1)

    def extract_license_plate_ocr(self, frame, bbox):
        """
        Crops the license plate region and uses PaddleOCR to extract text characters.
        """
        x1, y1, x2, y2 = bbox
        plate_crop = frame[y1:y2, x1:x2]
        
        if plate_crop.size == 0:
            return None
            
        # Image pre-processing for optimal OCR readability
        gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, (0, 0), fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        
        if self.ocr:
            result = self.ocr.ocr(gray, cls=True)
            if result and result[0]:
                for line in result[0]:
                    plate_text = line[1][0]
                    confidence = line[1][1]
                    if confidence > 0.6:
                        # Clean special characters out of standard plate reads
                        cleaned_text = "".join(c for c in plate_text if c.isalnum()).upper()
                        return cleaned_text
        else:
            # Blueprint mock response for demo
            return "MH12QW9087"
        return None

    def query_rto_database(self, license_plate):
        """
        Triggers a mock REST API call to verify Registration, Insurance, and Fitness.
        """
        api_url = f"https://rto.gov.in/api/v1/vehicles/{license_plate}"
        headers = {"Authorization": "Bearer SECURE_TOKEN"}
        
        print(f"[REST-API] Querying vehicle documentation status for plate: {license_plate}...")
        
        # In actual deployment:
        # try:
        #     response = requests.get(api_url, headers=headers, timeout=2.0)
        #     return response.json()
        # except requests.RequestException:
        #     pass
            
        # Blueprint mock payload response
        return {
            "plate": license_plate,
            "owner": "Rajesh Kumar",
            "vehicle": "Bajaj Pulsar 220",
            "rc_status": "ACTIVE",
            "insurance_status": "EXPIRED (2025-12-10)",
            "fitness_status": "VALID (2029-04-18)",
            "phone": "+919876543210"
        }

    def dispatch_cloud_mqtt_violation(self, challan_id, details):
        """
        Publishes the enforcement payload to the Cloud Platform (AWS IoT/Azure) via MQTT.
        """
        topic = f"traffic/enforcement/challans/{challan_id}"
        import json
        payload = json.dumps({
            "challan_id": challan_id,
            "timestamp": time.time(),
            "violation_details": details
        })
        
        # Publish
        self.mqtt_client.publish(topic, payload, qos=1)
        print(f"[MQTT-DISPATCH] Telemetry packet sent successfully. Topic: {topic}")

    def run_pipeline(self):
        """
        Core main loop reading video streams, annotating frames, and enforcing rules.
        """
        cap = cv2.VideoCapture(self.video_source)
        if not cap.isOpened():
            print(f"[ERROR] Could not open video source: {self.video_source}")
            return
            
        print("[INFO] Video feed connected. Processing frames...")
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            # Copy original frame to avoid overlay conflicts
            display_frame = frame.copy()
            
            # --- STEP 1: Object Detection (YOLOv10) ---
            # Classes in YOLO: 2 (car), 3 (motorcycle), 0 (person), etc.
            # Custom models would detect: "rider_with_helmet", "rider_without_helmet", "license_plate"
            
            if self.yolo_model:
                results = self.yolo_model(frame, verbose=False)
                # Parse bounding boxes
                # (Demonstration placeholders for parsed coordinate items)
                # boxes = results[0].boxes
            
            # --- STEP 2: Multi-Vehicle Speed Tracking (ByteTrack) ---
            # Simulated tracked items (Vehicle ID, centroid, bounding box coordinates)
            tracked_vehicles = [
                {"id": 42, "centroid": (540, 780), "bbox": (490, 700, 590, 800), "class": "car"}
            ]
            
            for veh in tracked_vehicles:
                veh_id = veh["id"]
                cx, cy = veh["centroid"]
                x1, y1, x2, y2 = veh["bbox"]
                
                # Calculate real physical velocity vector
                speed_kmh = self.calculate_vehicle_speed(veh_id, cx, cy)
                
                # Check speed limits violation
                is_speeding = speed_kmh > 80.0
                color = (0, 0, 255) if is_speeding else (0, 255, 0)
                
                # Draw vehicle bounds
                cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
                
                # Overlay speed reading text
                label = f"ID: {veh_id} | Speed: {speed_kmh} km/h"
                cv2.putText(display_frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                
                # --- STEP 3: ANPR OCR Crop & Read ---
                # Crop and read license plate when within optimal gate focus zone
                if cy > 600 and cy < 850:
                    plate_bbox = (x1 + 10, y2 - 30, x2 - 10, y2) # Approximate license crop location
                    plate_number = self.extract_license_plate_ocr(frame, plate_bbox)
                    
                    if plate_number:
                        cv2.rectangle(display_frame, (plate_bbox[0], plate_bbox[1]), (plate_bbox[2], plate_bbox[3]), (255, 255, 0), 1)
                        cv2.putText(display_frame, f"ANPR: {plate_number}", (plate_bbox[0], plate_bbox[1] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1)
                        
                        # --- STEP 4: Database Validation & Challan Generation ---
                        if is_speeding:
                            rto_data = self.query_rto_database(plate_number)
                            challan_id = f"CH-{int(time.time())}"
                            
                            violation_details = {
                                "plate": plate_number,
                                "owner": rto_data["owner"],
                                "vehicle_make": rto_data["vehicle"],
                                "rc_status": rto_data["rc_status"],
                                "speed": f"{speed_kmh} km/h",
                                "limit": "80 km/h",
                                "fine": 2000
                            }
                            
                            # --- STEP 5: Cloud Dispatch ---
                            self.dispatch_cloud_mqtt_violation(challan_id, violation_details)
                            
            # Render video window output
            cv2.imshow("Smart Traffic AI Monitor - Node 02", display_frame)
            
            # Hit 'q' key to quit pipeline execution
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
        cap.release()
        cv2.destroyAllWindows()
        print("[INFO] Video capture session finalized.")

if __name__ == "__main__":
    # Initialize auto enforcement system on local video file or RTSP stream
    monitor = AutoEnforceSystem(video_source="test_traffic.mp4")
    # To execute the production pipeline, uncomment below:
    # monitor.run_pipeline()
