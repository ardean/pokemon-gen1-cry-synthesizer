import CryType, { Command } from "./CryType";

export default class CryGenerator {
  audioContext: AudioContext;
  sourceSampleRate = 1048576;
  samplesPerFrame = 17556;
  noiseBuffer = 0x7FFF;

  init() {
    if (!this.audioContext) this.audioContext = new AudioContext();
  }

  generate(cryType: CryType, pitch: number, length: number) {
    const pulse1 = this.generateSquareWave(cryType.pulse1, pitch, length);
    const pulse2 = this.generateSquareWave(cryType.pulse2, pitch, length);
    // due to quirk with noise channel: find shortest channel length
    // at this point, noise will revert pitch shift effect

    let pulse1Length = 0;
    let pulse2Length = 0;
    let leftovers = 0;
    for (const command of cryType.pulse1) {
      if (command && command.note) {
        const subframes = ((length + 0x100) * (command.note[0] + 1)) + leftovers;
        const thisnote = this.samplesPerFrame * (subframes >> 8);
        leftovers = subframes & 0xFF;
        pulse1Length += thisnote;
      }
    }

    leftovers = 0;
    for (const command of cryType.pulse2) {
      if (command && command.note) {
        const subframes = ((length + 0x100) * (command.note[0] + 1)) + leftovers;
        const thisnote = this.samplesPerFrame * (subframes >> 8);
        leftovers = subframes & 0xFF;
        pulse2Length += thisnote;
      }
    }

    const cutoff = Math.max(pulse1Length, pulse2Length) - this.samplesPerFrame;
    const noise = this.generateNoise(cryType.noise, pitch, 0, cutoff);

    return {
      pulse1,
      pulse2,
      noise
    };
  }

  sample(bin: number, volume: number) {
    return (
      (
        (2 * bin) - 1
      ) * (
        (volume * -1) / 0x10
      )
    );
  }

  calcDuty(duty: number, periodCount: number) {
    switch (duty) {
      case 0: return periodCount >= 4 / 8 && periodCount < 5 / 8;
      case 1: return periodCount >= 4 / 8 && periodCount < 6 / 8;
      case 2: return periodCount >= 2 / 8 && periodCount < 6 / 8;
      case 3: return periodCount < 4 / 8 || periodCount >= 6 / 8;
    }
    return false;
  }

  generateSquareWave(commands: Command[], pitch: number, length: number) {
    let duty = 0;
    let data: number[] = [];
    let commandIndex = 0;
    let sampleIndex = 0;
    let periodCount = 0;
    let leftovers = 0;
    while (commandIndex < commands.length) {
      let command = commands[commandIndex];
      const isLastCommand = commandIndex === commands.length - 1;
      if (typeof command.duty !== "undefined") {
        duty = command.duty;
      } else if (command.note) {
        let [
          numberOfSamplesPerNote,
          volume,
          volumeFade,
          numberOfSamplesPerPeriod
        ] = command.note;

        // number of samples for this single note
        let subframes = (
          (length + 0x100) *
          (numberOfSamplesPerNote + 1)
        ) + leftovers;
        let sampleCount = this.samplesPerFrame * (subframes >> 8);
        leftovers = subframes & 0xFF;
        // number of samples for a single period of the note's pitch
        let period = this.sourceSampleRate * (
          2048 - (
            (
              numberOfSamplesPerPeriod +
              pitch
            ) & 0x7FF
          )
        ) / 131072;
        // apply this note

        for (let index = 0; index < 2500000 && (index < sampleCount || (isLastCommand && volume > 0)); index++) {
          const enabled = this.calcDuty(duty & 0b11, periodCount) ?
            1 :
            0;
          data[sampleIndex] = this.sample(enabled, volume);
          periodCount += 1 / period;
          periodCount = periodCount >= 1 ?
            periodCount - 1 :
            periodCount;
          sampleIndex++;

          // once per frame, adjust duty
          if (
            index < sampleCount &&
            sampleIndex % this.samplesPerFrame === 0
          ) {
            duty = (
              (
                (
                  duty & 0x3F
                ) << 2
              ) | (
                (
                  duty & 0xC0
                ) >> 6
              )
            );
          }

          // once per frame * fadeamount, adjust volume
          if (
            volumeFade !== 0 &&
            (index + 1) % (this.samplesPerFrame * Math.abs(volumeFade)) === 0
          ) {
            volume += (volumeFade < 0 ? 1 : -1);
            volume = volume < 0 ? 0 : (volume > 0x0F ? 0x0F : volume);
          }
        }
      }

      commandIndex++;
    }

    return data;
  }

  generateNoise(commands: Command[], pitch: number, length: number, cutoff: number) {
    let data: number[] = [];
    let commandIndex = 0;
    let sampleIndex = 0;
    let leftovers = 0;
    while (commandIndex < commands.length) {
      const command = commands[commandIndex];
      const isLastCommand = commandIndex === commands.length - 1;
      let note = command.note;
      // number of samples for this single note
      let subFrames = ((length + 0x100) * (note[0] + 1)) + leftovers;
      let sampleCount = this.samplesPerFrame * (subFrames >> 8);
      leftovers = subFrames & 0xFF;
      // volume and fade control
      let volume = note[1], volumeFade = note[2], params = (note[3] + (sampleIndex >= cutoff ? 0 : pitch)) & 0xFF;
      // apply this note
      let shift = (params >> 4) & 0xF;
      shift = shift > 0xD ? shift & 0xD : shift; // not sure how to deal with E or F, but its so low you can hardly notice it anyway

      let divider = params & 0x7;
      let width = (params & 0x8) === 0x8;
      this.noiseBuffer = 0x7FFF;

      for (let index = 0; index < 2500000 && (index < sampleCount || (isLastCommand && volume > 0)); index++) {
        let bit0 = this.noiseBuffer & 1;
        data[sampleIndex] = this.sample(1 ^ bit0, volume);
        sampleIndex++;
        // according to params, update buffer
        if (
          sampleIndex % (2 * (divider === 0 ? 0.5 : divider) * (1 << (shift + 1))) === 0
        ) {
          let bit1 = (this.noiseBuffer >> 1) & 1;
          this.noiseBuffer = (this.noiseBuffer >> 1) | ((bit0 ^ bit1) << 14);
          if (width) this.noiseBuffer = (this.noiseBuffer >> 1) | ((bit0 ^ bit1) << 6);
        }
        // once per frame * fadeamount, adjust volume
        if (
          volumeFade !== 0 &&
          (index + 1) % (this.samplesPerFrame * Math.abs(volumeFade)) === 0
        ) {
          volume += (volumeFade < 0 ? 1 : -1);
          volume = volume < 0 ? 0 : (volume > 0x0F ? 0x0F : volume);
        }
      }
      commandIndex++;
    }
    return data;
  }

  play(data: number[]) {
    const buffer = Float32Array.from(data);
    const audioBuffer = this.audioContext.createBuffer(
      1,
      buffer.length,
      this.audioContext.sampleRate
    );
    audioBuffer.copyToChannel(buffer, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start(0);
  }
}