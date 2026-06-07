#!/usr/bin/env python3
import os
import sys
import json
import glob
import numpy as np
from scipy.io import wavfile

def estimate_pitch(wav_path):
    try:
        sample_rate, audio_data = wavfile.read(wav_path)
    except Exception as e:
        print(f"Error reading {wav_path}: {e}", file=sys.stderr)
        return 0.0

    # Convert to float and normalize
    if audio_data.dtype == np.int16:
        audio_data = audio_data.astype(np.float32) / 32768.0
    elif audio_data.dtype == np.int32:
        audio_data = audio_data.astype(np.float32) / 2147483648.0
    elif audio_data.dtype == np.uint8:
        audio_data = (audio_data.astype(np.float32) - 128.0) / 128.0

    # Convert to mono if stereo
    if len(audio_data.shape) > 1:
        audio_data = audio_data.mean(axis=1)

    # Autocorrelation parameters
    frame_size = 2048
    hop_size = 512
    min_lag = int(sample_rate / 400) # 400 Hz
    max_lag = int(sample_rate / 50)  # 50 Hz

    pitches = []

    # Process in frames
    for start in range(0, len(audio_data) - frame_size, hop_size):
        frame = audio_data[start:start+frame_size]
        # Remove DC offset
        frame = frame - np.mean(frame)
        
        # Energy threshold
        rms = np.sqrt(np.mean(frame**2))
        if rms < 0.005: # Skip silent frames
            continue

        # Autocorrelation
        corr = np.correlate(frame, frame, mode='full')
        corr = corr[len(corr)//2:]

        if len(corr) > max_lag:
            lag_range = corr[min_lag:max_lag]
            peak_idx = np.argmax(lag_range) + min_lag
            
            # Convert lag to frequency
            if peak_idx > 0:
                freq = sample_rate / peak_idx
                if 50 <= freq <= 400:
                    pitches.append(freq)

    if not pitches:
        return 0.0
    # Use median to avoid outliers
    return float(np.median(pitches))

def cluster_speakers(pitches_dict):
    filenames = list(pitches_dict.keys())
    pitches = np.array([pitches_dict[f] for f in filenames])

    # Filter out files with no detected pitch (0.0)
    valid_indices = [i for i, p in enumerate(pitches) if p > 0.0]
    
    labels = {}
    
    # If we have no valid pitches or only 1 valid pitch, default all to speaker A
    if len(valid_indices) < 2:
        for f in filenames:
            labels[f] = "A"
        return labels

    valid_pitches = pitches[valid_indices]
    
    # Initialize 1D K-means with min and max pitch
    c1 = np.min(valid_pitches)
    c2 = np.max(valid_pitches)
    
    # Run K-means for 10 iterations
    for _ in range(10):
        d1 = np.abs(valid_pitches - c1)
        d2 = np.abs(valid_pitches - c2)
        
        grp1 = valid_pitches[d1 < d2]
        grp2 = valid_pitches[d1 >= d2]
        
        if len(grp1) > 0:
            c1 = np.mean(grp1)
        if len(grp2) > 0:
            c2 = np.mean(grp2)

    # Sort centroids so Speaker A has the lower pitch (more consistent labeling)
    c_low, c_high = (c1, c2) if c1 < c2 else (c2, c1)

    for i, filename in enumerate(filenames):
        pitch = pitches_dict[filename]
        if pitch == 0.0:
            # If pitch wasn't detected, assign to the closer group or default to A
            labels[filename] = "A"
        else:
            dist_low = abs(pitch - c_low)
            dist_high = abs(pitch - c_high)
            labels[filename] = "A" if dist_low < dist_high else "B"

    return labels

def main():
    if len(sys.argv) < 2:
        print("Usage: voice_analyzer.py <directory_of_wav_files>", file=sys.stderr)
        sys.exit(1)

    dir_path = sys.argv[1]
    if not os.path.isdir(dir_path):
        print(f"Directory not found: {dir_path}", file=sys.stderr)
        sys.exit(1)

    # Find all wav files
    wav_files = sorted(glob.glob(os.path.join(dir_path, "*.wav")))
    
    pitches_dict = {}
    for f in wav_files:
        basename = os.path.basename(f)
        pitches_dict[basename] = estimate_pitch(f)

    # Run clustering
    labels = cluster_speakers(pitches_dict)

    # Print JSON output to stdout
    print(json.dumps(labels))

if __name__ == "__main__":
    main()
