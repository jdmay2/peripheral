/**
 * Default IMU data parsers for common BLE IMU characteristic formats.
 *
 * Most BLE IMU sensors transmit accelerometer + gyroscope data as
 * packed little-endian int16 values. These parsers handle the most
 * common formats; consumers can supply custom parsers via IMUParserFn.
 */

import type { IMUSample } from '@peripheral/gesture-engine';
import type { IMUParserFn } from '../types';

/**
 * Create a 6-axis IMU parser for packed int16 LE notifications.
 *
 * Format per sample (12 bytes):
 *   [ax_lo, ax_hi, ay_lo, ay_hi, az_lo, az_hi,
 *    gx_lo, gx_hi, gy_lo, gy_hi, gz_lo, gz_hi]
 *
 * @param scaleFactor.accel - Divisor for accelerometer (default 16384 = +/-2g MPU-6050)
 * @param scaleFactor.gyro - Divisor for gyroscope (default 131 = +/-250 deg/s MPU-6050)
 */
export function createIMU6AxisParser(
  scaleFactor?: { accel?: number; gyro?: number }
): IMUParserFn {
  const accelScale = scaleFactor?.accel ?? 16384;
  const gyroScale = scaleFactor?.gyro ?? 131;

  return (value: number[], timestamp: number): IMUSample[] => {
    if (value.length < 12) return [];

    const buffer = new ArrayBuffer(value.length);
    const uint8 = new Uint8Array(buffer);
    for (let i = 0; i < value.length; i++) {
      uint8[i] = value[i]! & 0xff;
    }
    const dv = new DataView(buffer);

    const sampleSize = 12;
    const count = Math.floor(value.length / sampleSize);
    const samples: IMUSample[] = [];

    for (let s = 0; s < count; s++) {
      const offset = s * sampleSize;
      samples.push({
        ax: dv.getInt16(offset, true) / accelScale,
        ay: dv.getInt16(offset + 2, true) / accelScale,
        az: dv.getInt16(offset + 4, true) / accelScale,
        gx: dv.getInt16(offset + 6, true) / gyroScale,
        gy: dv.getInt16(offset + 8, true) / gyroScale,
        gz: dv.getInt16(offset + 10, true) / gyroScale,
        timestamp:
          count > 1
            ? timestamp - (count - 1 - s) * (1000 / 50)
            : timestamp,
      });
    }

    return samples;
  };
}

/**
 * Create a 3-axis accelerometer-only parser for packed int16 LE notifications.
 *
 * Format per sample (6 bytes): [ax_lo, ax_hi, ay_lo, ay_hi, az_lo, az_hi]
 *
 * @param accelScale - Divisor for accelerometer (default 16384 = +/-2g)
 */
export function createIMU3AxisParser(accelScale?: number): IMUParserFn {
  const scale = accelScale ?? 16384;

  return (value: number[], timestamp: number): IMUSample[] => {
    if (value.length < 6) return [];

    const buffer = new ArrayBuffer(value.length);
    const uint8 = new Uint8Array(buffer);
    for (let i = 0; i < value.length; i++) {
      uint8[i] = value[i]! & 0xff;
    }
    const dv = new DataView(buffer);

    const sampleSize = 6;
    const count = Math.floor(value.length / sampleSize);
    const samples: IMUSample[] = [];

    for (let s = 0; s < count; s++) {
      const offset = s * sampleSize;
      samples.push({
        ax: dv.getInt16(offset, true) / scale,
        ay: dv.getInt16(offset + 2, true) / scale,
        az: dv.getInt16(offset + 4, true) / scale,
        timestamp:
          count > 1
            ? timestamp - (count - 1 - s) * (1000 / 50)
            : timestamp,
      });
    }

    return samples;
  };
}

/**
 * Create a 9-axis IMU parser for packed int16 LE notifications.
 *
 * Format per sample (18 bytes):
 *   [ax_lo, ax_hi, ay_lo, ay_hi, az_lo, az_hi,
 *    gx_lo, gx_hi, gy_lo, gy_hi, gz_lo, gz_hi,
 *    mx_lo, mx_hi, my_lo, my_hi, mz_lo, mz_hi]
 *
 * Magnetometer data is stored in the sample metadata via the returned
 * IMUSample. Since IMUSample doesn't have magnetometer fields, the
 * magnetic data is accessible via the custom `magnetometer` property
 * on the returned samples (cast to IMU9AxisSample for typed access).
 *
 * @param scaleFactor.accel - Divisor for accelerometer (default 16384 = +/-2g MPU-9250)
 * @param scaleFactor.gyro - Divisor for gyroscope (default 131 = +/-250 deg/s MPU-9250)
 * @param scaleFactor.mag - Divisor for magnetometer (default 6.6667 = +/-4800µT MPU-9250)
 */
export function createIMU9AxisParser(
  scaleFactor?: { accel?: number; gyro?: number; mag?: number }
): IMUParserFn {
  const accelScale = scaleFactor?.accel ?? 16384;
  const gyroScale = scaleFactor?.gyro ?? 131;
  const magScale = scaleFactor?.mag ?? 6.6667;

  return (value: number[], timestamp: number): IMUSample[] => {
    if (value.length < 18) return [];

    const buffer = new ArrayBuffer(value.length);
    const uint8 = new Uint8Array(buffer);
    for (let i = 0; i < value.length; i++) {
      uint8[i] = value[i]! & 0xff;
    }
    const dv = new DataView(buffer);

    const sampleSize = 18;
    const count = Math.floor(value.length / sampleSize);
    const samples: IMUSample[] = [];

    for (let s = 0; s < count; s++) {
      const offset = s * sampleSize;
      const sample: IMUSample & {
        mx?: number;
        my?: number;
        mz?: number;
      } = {
        ax: dv.getInt16(offset, true) / accelScale,
        ay: dv.getInt16(offset + 2, true) / accelScale,
        az: dv.getInt16(offset + 4, true) / accelScale,
        gx: dv.getInt16(offset + 6, true) / gyroScale,
        gy: dv.getInt16(offset + 8, true) / gyroScale,
        gz: dv.getInt16(offset + 10, true) / gyroScale,
        mx: dv.getInt16(offset + 12, true) / magScale,
        my: dv.getInt16(offset + 14, true) / magScale,
        mz: dv.getInt16(offset + 16, true) / magScale,
        timestamp:
          count > 1
            ? timestamp - (count - 1 - s) * (1000 / 50)
            : timestamp,
      };
      samples.push(sample);
    }

    return samples;
  };
}

/** Default 6-axis parser with standard MPU-6050 scale factors */
export const parseIMU6Axis = createIMU6AxisParser();

/** Default 3-axis parser with standard accelerometer scale */
export const parseIMU3Axis = createIMU3AxisParser();

/** Default 9-axis parser with standard MPU-9250 scale factors */
export const parseIMU9Axis = createIMU9AxisParser();
