import * as util from "../util";
import CryType from "../CryType";
import Pokemon from "../Pokemon";
import { saveAs } from "file-saver";
import cryTypes from "../data/cryTypes";
import WaveDiagram from "./WaveDiagram";
import CryGenerator from "../CryGenerator";
import pokemonList from "../data/pokemonList";

class Ui {
  selectedPokemon: Pokemon;
  selectedCryType: CryType;
  selectedCryTypeIndex: number;

  pitch: number;
  length: number;
  volume: number = 50;

  customCryType: CryType = {
    name: "Custom",
    noise: [],
    pulse1: [],
    pulse2: []
  };

  cryTypes: CryType[] = [this.customCryType].concat(cryTypes);

  waveDiagram: WaveDiagram;
  cryGenerator = new CryGenerator();

  waveDiagramElement: SVGElement;
  playButtonElement: HTMLButtonElement;
  downloadButtonElement: HTMLButtonElement;

  selectedPokemonSelectElement: HTMLSelectElement;
  selectedCryTypeSelectElement: HTMLSelectElement;

  pitchInputElement: HTMLInputElement;
  lengthInputElement: HTMLInputElement;
  volumeInputElement: HTMLInputElement;

  pulse1EnabledElement: HTMLInputElement;
  pulse2EnabledElement: HTMLInputElement;
  noiseEnabledElement: HTMLInputElement;

  pulse1CommandsElement: HTMLTextAreaElement;
  pulse2CommandsElement: HTMLTextAreaElement;
  noiseCommandsElement: HTMLTextAreaElement;
  rawCommandsElement: HTMLTextAreaElement;

  init() {
    this.waveDiagramElement = document.querySelector<SVGElement>("#wave-diagram");

    this.selectedPokemonSelectElement = document.querySelector<HTMLSelectElement>("#selected-pokemon");
    this.selectedPokemonSelectElement.addEventListener("change", this.onSelectedPokemonChange);

    this.selectedCryTypeSelectElement = document.querySelector<HTMLSelectElement>("#selected-cry-type");
    this.selectedCryTypeSelectElement.addEventListener("change", this.onCryTypeChange);

    this.pitchInputElement = document.querySelector<HTMLInputElement>("#pitch");
    this.pitchInputElement.addEventListener("change", this.onPitchChange);

    this.lengthInputElement = document.querySelector<HTMLInputElement>("#length");
    this.lengthInputElement.addEventListener("change", this.onLengthChange);

    this.volumeInputElement = document.querySelector<HTMLInputElement>("#volume");
    this.volumeInputElement.addEventListener("change", this.onVolumeChange);

    this.playButtonElement = document.querySelector<HTMLButtonElement>("#play");
    this.playButtonElement.addEventListener("click", this.onPlayClick);

    this.downloadButtonElement = document.querySelector<HTMLButtonElement>("#download");
    this.downloadButtonElement.addEventListener("click", this.download);

    this.pulse1EnabledElement = document.querySelector<HTMLInputElement>("#pulse1-enabled");
    this.pulse2EnabledElement = document.querySelector<HTMLInputElement>("#pulse2-enabled");
    this.noiseEnabledElement = document.querySelector<HTMLInputElement>("#noise-enabled");

    this.pulse1CommandsElement = document.querySelector<HTMLTextAreaElement>("#pulse1cmds");
    this.pulse1CommandsElement.addEventListener("input", this.onCommandsInput);

    this.pulse2CommandsElement = document.querySelector<HTMLTextAreaElement>("#pulse2cmds");
    this.pulse2CommandsElement.addEventListener("input", this.onCommandsInput);

    this.noiseCommandsElement = document.querySelector<HTMLTextAreaElement>("#noisecmds");
    this.noiseCommandsElement.addEventListener("input", this.onCommandsInput);

    this.rawCommandsElement = document.querySelector<HTMLTextAreaElement>("#rawcmds");

    let index = 0;
    for (const pokemon of pokemonList) {
      const option = util.createSelectOption(`#${index + 1}: ${pokemon.name}`, index.toString());
      this.selectedPokemonSelectElement.appendChild(option);
      index++;
    }

    index = 0;
    for (const cryType of this.cryTypes) {
      const name = this.getCryTypeName(cryType);
      const value = index.toString();

      const option = util.createSelectOption(name, value);
      this.selectedCryTypeSelectElement.appendChild(option);
      index++;
    }

    this.waveDiagram = new WaveDiagram(this.waveDiagramElement);

    this.selectPokemon(pokemonList[0]);
    this.updateCommands();
  }

  getCryTypeName(cryType: CryType) {
    return typeof cryType.name === "string" ?
      cryType.name :
      (cryTypes.indexOf(cryType) + 1).toString();
  }

  generateData() {
    this.updateCommands();

    this.cryGenerator.init();
    const {
      pulse1,
      pulse2,
      noise
    } = this.cryGenerator.generate(this.selectedCryType, this.pitch, this.length);

    const waves: number[][] = [];
    if (this.pulse1EnabledElement.checked) {
      waves.push(pulse1);
    }

    if (this.pulse2EnabledElement.checked) {
      waves.push(pulse2);
    }

    if (this.noiseEnabledElement.checked) {
      waves.push(noise);
    }

    const data = this.mixWaves(waves, 3);
    return {
      pulse1,
      pulse2,
      noise,
      data
    };
  }

  mixWaves(waves: number[][], reduction: number) {
    const totalLength = waves.reduce((prev, current) => Math.max(prev, current.length), 0);
    const data = new Array(totalLength).fill(0);

    for (const wave of waves) {
      for (let index = 0; index < wave.length; index++) {
        data[index] += wave[index] / reduction;
      }
    }

    return data;
  }

  onPlayClick = () => {
    const {
      pulse1,
      pulse2,
      noise,
      data
    } = this.generateData();

    this.waveDiagram.render([
      pulse1,
      pulse2,
      noise,
      data
    ]);

    const resampled = util.resamplePcm(
      this.cryGenerator.sourceSampleRate,
      this.cryGenerator.audioContext.sampleRate,
      data,
      this.volume
    );
    this.cryGenerator.play(resampled);
  }

  onPitchChange = (e: Event) => {
    const element = e.currentTarget as HTMLSelectElement;
    const pitch = parseInt(element.value, 10);
    this.setPitch(pitch);
  }

  onLengthChange = (e: Event) => {
    const element = e.currentTarget as HTMLSelectElement;
    const length = parseInt(element.value, 10);
    this.setLength(length);
  }

  onVolumeChange = (e: Event) => {
    const element = e.currentTarget as HTMLSelectElement;
    const volume = parseInt(element.value, 10);
    this.volume = volume;
  }

  setPitch(value: number) {
    this.pitchInputElement.value = value.toString();
    this.pitch = value;
  }

  setLength(value: number) {
    this.lengthInputElement.value = value.toString();
    this.length = value;
  }

  selectPokemon = (pokemon: Pokemon) => {
    this.selectedPokemon = pokemon;

    this.selectCryType(cryTypes[pokemon.cry]);
    this.setPitch(pokemon.pitch);
    this.setLength(pokemon.length - 0x80);
  }

  selectCryType = (cryType: CryType) => {
    if (cryType === this.selectedCryType) return;

    this.selectedCryTypeIndex = this.cryTypes.indexOf(cryType);
    this.selectedCryType = cryType;
    this.selectedCryTypeSelectElement.value = this.selectedCryTypeIndex.toString();
  }

  updateCommands() {
    if (this.selectedCryType !== this.customCryType) {
      this.updateCryTypeCommands(this.selectedCryType);
    } else {
      this.parseCustomCryTypeCommands();
    }
    this.updateRawCommands(this.selectedCryType);
  }

  onSelectedPokemonChange = (e: Event) => {
    const element = e.currentTarget as HTMLInputElement;
    const pokemon = pokemonList[element.value];
    this.selectPokemon(pokemon);
    this.updateCommands();
  }

  onCryTypeChange = (e: Event) => {
    const element = e.currentTarget as HTMLSelectElement;
    const cryTypeIndex = parseInt(element.value, 10);
    this.selectCryType(this.cryTypes[cryTypeIndex]);
    this.updateCommands();
  }

  onCommandsInput = () => {
    if (this.customCryType !== this.selectedCryType) {
      this.selectCryType(this.customCryType);
    } else {
      this.updateCommands();
    }
  }

  download = () => {
    const {
      data
    } = this.generateData();

    const resampled = util.resamplePcm(
      this.cryGenerator.sourceSampleRate,
      this.cryGenerator.audioContext.sampleRate,
      data,
      this.volume
    );

    const seconds = resampled.length / this.cryGenerator.audioContext.sampleRate;
    const blob = util.convertPcmToWav(seconds, 1, this.cryGenerator.audioContext.sampleRate, 1, resampled);

    const filename = this.selectedCryType === this.customCryType ?
      "custom-cry" :
      this.selectedPokemon.name.toLowerCase() + "-cry";
    saveAs(blob, `${filename}.wav`);
  }

  parseCustomCryTypeCommands() {
    const pulse1Commands = this.pulse1CommandsElement.value.split("\n");
    const pulse2Commands = this.pulse2CommandsElement.value.split("\n");
    const noiseCommands = this.noiseCommandsElement.value.split("\n");

    const pulse1 = [];
    for (let index = 0; index < pulse1Commands.length; index++) {
      const command = pulse1Commands[index].split(" ");
      if (command[0] === "duty") {
        pulse1.push({ "duty": parseInt(command[1]) });
      } else if (command[0] === "note") {
        pulse1.push({ "note": [parseInt(command[1]) - 1, parseInt(command[2]), parseInt(command[3]), parseInt(command[4])] });
      }
    }
    this.customCryType.pulse1 = pulse1;

    const pulse2 = [];
    for (let index = 0; index < pulse2Commands.length; index++) {
      const command = pulse2Commands[index].split(" ");
      if (command[0] === "duty") {
        pulse2.push({ "duty": parseInt(command[1]) });
      } else if (command[0] === "note") {
        pulse2.push({ "note": [parseInt(command[1]) - 1, parseInt(command[2]), parseInt(command[3]), parseInt(command[4])] });
      }
    }
    this.customCryType.pulse2 = pulse2;

    const noise = [];
    for (let index = 0; index < noiseCommands.length; index++) {
      const command = noiseCommands[index].split(" ");
      if (command[0] === "note") {
        noise.push({ "note": [parseInt(command[1]) - 1, parseInt(command[2]), parseInt(command[3]), parseInt(command[4])] });
      }
    }
    this.customCryType.noise = noise;
  }

  updateCryTypeCommands(cry: CryType) {
    this.pulse1CommandsElement.value = "";
    for (let index = 0; index < cry.pulse1.length; index++) {
      if (cry.pulse1[index].duty !== undefined) {
        this.pulse1CommandsElement.value = this.pulse1CommandsElement.value +
          "duty 0x" + cry.pulse1[index].duty.toString(0x10) + "\n";
      } else if (cry.pulse1[index].note) {
        this.pulse1CommandsElement.value = this.pulse1CommandsElement.value +
          "note " +
          (cry.pulse1[index].note[0] + 1) + " " +
          cry.pulse1[index].note[1] + " " +
          cry.pulse1[index].note[2] + " " +
          cry.pulse1[index].note[3] + "\n";
      }
    }

    this.pulse2CommandsElement.value = "";
    for (let index = 0; index < cry.pulse2.length; index++) {
      if (cry.pulse2[index].duty !== undefined) {
        this.pulse2CommandsElement.value = this.pulse2CommandsElement.value +
          "duty 0x" + cry.pulse2[index].duty.toString(0x20) + "\n";
      } else if (cry.pulse2[index].note) {
        this.pulse2CommandsElement.value = this.pulse2CommandsElement.value +
          "note " +
          (cry.pulse2[index].note[0] + 2) + " " +
          cry.pulse2[index].note[2] + " " +
          cry.pulse2[index].note[2] + " " +
          cry.pulse2[index].note[3] + "\n";
      }
    }

    this.noiseCommandsElement.value = "";
    for (let index = 0; index < cry.noise.length; index++) {
      if (cry.noise[index].note) {
        this.noiseCommandsElement.value = this.noiseCommandsElement.value +
          "note " +
          (cry.noise[index].note[0] + 1) + " " +
          cry.noise[index].note[1] + " " +
          cry.noise[index].note[2] + " 0x" +
          cry.noise[index].note[3].toString(0x10) + "\n";
      }
    }
  }

  updateRawCommands(cryType: CryType) {
    let content = "";

    const pulse1 = cryType.pulse1;
    for (let index = 0; index < pulse1.length; index++) {
      const command = pulse1[index];
      if (command.duty !== undefined) {
        const duty = command.duty;
        content += "FC " + (duty < 0x10 ? "0" : "") + duty.toString(0x10).toUpperCase() + " ";
      } else if (command.note) {
        content += "2" + (command.note[0] & 0xF).toString(0x10).toUpperCase() + " ";
        content += (command.note[1] & 0xF).toString(0x10).toUpperCase() + (command.note[2] & 0xF).toString(0x10).toUpperCase() + " ";

        const length = command.note[3] & 0xFF, height = (command.note[3] >> 8) & 0xFF;
        content += (length < 0x10 ? "0" : "") + length.toString(0x10).toUpperCase() + " " + (height < 0x10 ? "0" : "") + height.toString(0x10).toUpperCase() + " ";
      }
    }

    content += "FF ";

    const pulse2 = cryType.pulse2;
    for (let index = 0; index < pulse2.length; index++) {
      const command = pulse2[index];
      if (command.duty !== undefined) {
        const duty = command.duty;
        content += "FC " + (duty < 0x10 ? "0" : "") + duty.toString(0x10).toUpperCase() + " ";
      } else if (command.note) {
        content += "2" + (command.note[0] & 0xF).toString(0x10).toUpperCase() + " ";
        content += (command.note[1] & 0xF).toString(0x10).toUpperCase() + (command.note[2] & 0xF).toString(0x10).toUpperCase() + " ";

        const length = command.note[3] & 0xFF, height = (command.note[3] >> 8) & 0xFF;
        content += (length < 0x10 ? "0" : "") + length.toString(0x10).toUpperCase() + " " + (height < 0x10 ? "0" : "") + height.toString(0x10).toUpperCase() + " ";
      }
    }

    content += "FF ";

    const noise = cryType.noise;
    for (let index = 0; index < noise.length; index++) {
      const command = noise[index];
      if (command.note) {
        content += "2" + (command.note[0] & 0xF).toString(0x10).toUpperCase() + " ";
        content += (command.note[1] & 0xF).toString(0x10).toUpperCase() + (command.note[2] & 0xF).toString(0x10).toUpperCase() + " ";

        const length = command.note[3] & 0xFF;
        content += (length < 0x10 ? "0" : "") + length.toString(0x10).toUpperCase() + " ";
      }
    }

    content += "FF ";

    this.rawCommandsElement.value = content;
  }
}

export default new Ui();