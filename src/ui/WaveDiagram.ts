export default class WaveDiagram {
  chunkSize = 10000;
  diminution = 20;

  constructor(
    private element: SVGElement
  ) { }

  render(waves: number[][]) {
    this.element.innerHTML = "";

    let index = 0;
    for (const wave of waves) {
      this.renderWave(wave, index, waves.length);
      index++;
    }
  }

  renderWave(wave: number[], waveIndex: number, waveCount: number) {
    let singleWaveMaxHeight = 400 / waveCount;
    let baseY = waveIndex * singleWaveMaxHeight;
    const waveChunkCount = Math.ceil(wave.length / this.chunkSize / this.diminution);

    for (let chunkIndex = 0; chunkIndex < waveChunkCount; chunkIndex++) {
      const element = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      element.style.fill = "none";
      element.style.stroke = "black";
      element.style.strokeWidth = "3";

      const points: string[] = [];
      for (let chunkPosition = 0; chunkPosition < this.chunkSize; chunkPosition++) {
        const position = this.chunkSize * chunkIndex + chunkPosition;
        const waveDataIndex = this.diminution * position;
        const waveData = wave[waveDataIndex];

        if (typeof waveData === "undefined") {
          break;
        }

        const x = position / 4;
        const y = Math.round(
          100 * (
            baseY +
            singleWaveMaxHeight * waveData / 2 +
            singleWaveMaxHeight / 2
          )
        ) / 100;

        const point = [x, y];
        points.push(point.join(","));
      }

      element.setAttribute("points", points.join(" "));

      this.element.appendChild(element);
    }
  }
}