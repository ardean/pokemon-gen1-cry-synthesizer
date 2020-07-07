import { Buffer } from "buffer";

export const createSelectOption = (text: string, value: string) => {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;

  return option;
};

export const convertPcmToWav = (
  durationInSeconds: number,
  numberOfChannels: number,
  sampleRate: number,
  bytesPerSample: number,
  samples: number[]
) => {
  const bitsPerSample = bytesPerSample * 8;
  const sampleSize = numberOfChannels * bytesPerSample;
  const bytesPerSecond = sampleSize * sampleRate;
  const dataSize = durationInSeconds * bytesPerSecond;
  const fullSize = 44 + dataSize;

  const buffer = Buffer.alloc(fullSize);
  let offset = 0;

  buffer.write("RIFF", offset, "utf8");
  offset += 4;

  buffer.writeUInt32LE(fullSize, offset);
  offset += 4;

  buffer.write("WAVE", offset, "utf8");
  offset += 4;

  buffer.write("fmt ", offset, "utf8");
  offset += 4;

  buffer.writeUInt32LE(16, offset); // remaining header size
  offset += 4;

  buffer.writeUInt16LE(1, offset); // PCM type
  offset += 2;

  buffer.writeUInt16LE(numberOfChannels, offset);
  offset += 2;

  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4;

  buffer.writeUInt32LE(bytesPerSecond, offset);
  offset += 4;

  buffer.writeUInt16LE(sampleSize, offset);
  offset += 2;

  buffer.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  buffer.write("data", offset, "utf8");
  offset += 4;

  buffer.writeUInt32LE(dataSize, offset);
  offset += 4;

  for (let secondIndex = 0; secondIndex < durationInSeconds; secondIndex++) {
    for (let currentSecondSampleIndex = 0; currentSecondSampleIndex < sampleRate; currentSecondSampleIndex += bytesPerSample) {
      const sampleIndex = secondIndex * sampleRate + currentSecondSampleIndex;

      let value = samples[sampleIndex];
      if (typeof value === "undefined") break;

      const scaledValue = (value * 0xFF) + (0xFF / 2);
      value = scaledValue & 0xFF;

      buffer.writeUInt8(value, offset);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
};

export const resamplePcm = (
  fromSampleRate: number,
  toSampleRate: number,
  data: number[],
  volume: number = 100
) => {
  const resampled: number[] = [];
  const resampleRateRatio = fromSampleRate / toSampleRate;
  const resampledLength = Math.ceil(data.length / resampleRateRatio);
  const volumeFactor = volume / 0x100;

  for (let resampledIndex = 0; resampledIndex < resampledLength; resampledIndex++) {
    const index = Math.floor(resampledIndex * resampleRateRatio);
    const fraction = resampledIndex * resampleRateRatio - index;
    resampled[resampledIndex] = (
      (1 - fraction) * data[index] +
      fraction * data[index + 1]
    ) * volumeFactor;
  }

  return resampled;
};