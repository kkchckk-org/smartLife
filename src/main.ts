import './style.css';
import { initCanvas } from './canvas';
import { initInput } from './input';

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
initCanvas(canvas);
initInput(canvas);

// TODO: ここから機能を繋いでいく
