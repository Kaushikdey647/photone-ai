const VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

import gradeFrag from "./shaders/grade.frag?raw";
import { parseCubeFile } from "./cubeLut";

export interface PipelineAdjustments {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  temperature: number;
  tint: number;
}

export class EditorPipeline {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject | null = null;
  private texImage: WebGLTexture | null = null;
  private texLut: WebGLTexture | null = null;
  private lutSize = 0;
  private loc = {
    image: null as WebGLUniformLocation | null,
    lut: null as WebGLUniformLocation | null,
    lutSize: null as WebGLUniformLocation | null,
    useLut: null as WebGLUniformLocation | null,
    adj0: null as WebGLUniformLocation | null,
    adj1: null as WebGLUniformLocation | null,
  };

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL2 not available");
    this.gl = gl;
    this.program = this.createProgram(VERT, gradeFrag);
    this.initGeometry();
    this.buildPlaceholderImage(256, 256);
    this.loc.image = this.gl.getUniformLocation(this.program, "u_image");
    this.loc.lut = this.gl.getUniformLocation(this.program, "u_lut");
    this.loc.lutSize = this.gl.getUniformLocation(this.program, "u_lutSize");
    this.loc.useLut = this.gl.getUniformLocation(this.program, "u_useLut");
    this.loc.adj0 = this.gl.getUniformLocation(this.program, "u_adj0");
    this.loc.adj1 = this.gl.getUniformLocation(this.program, "u_adj1");
  }

  /** Reset the 2D texture to the built-in gradient placeholder. */
  loadPlaceholder() {
    this.buildPlaceholderImage(256, 256);
  }

  /** Replace the preview texture from a fetchable URL (e.g. Tauri `convertFileSrc` for local files). */
  async loadImageFromUrl(url: string) {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image failed to load"));
      img.src = url;
    });
    const gl = this.gl;
    if (this.texImage) gl.deleteTexture(this.texImage);
    const tex = gl.createTexture();
    if (!tex) throw new Error("tex2d");
    this.texImage = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  dispose() {
    const gl = this.gl;
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.texImage) gl.deleteTexture(this.texImage);
    if (this.texLut) gl.deleteTexture(this.texLut);
    gl.deleteProgram(this.program);
  }

  resize(width: number, height: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    this.gl.canvas.width = w;
    this.gl.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  async loadLutFromUrl(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`LUT fetch failed: ${res.status}`);
    const text = await res.text();
    const { size, data } = parseCubeFile(text);
    const gl = this.gl;
    if (this.texLut) gl.deleteTexture(this.texLut);
    const tex = gl.createTexture();
    if (!tex) throw new Error("texture");
    this.texLut = tex;
    this.lutSize = size;
    gl.bindTexture(gl.TEXTURE_3D, tex);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGBA,
      size,
      size,
      size,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    );
    gl.bindTexture(gl.TEXTURE_3D, null);
  }

  clearLut() {
    if (this.texLut) this.gl.deleteTexture(this.texLut);
    this.texLut = null;
    this.lutSize = 0;
  }

  draw(adj: PipelineAdjustments) {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texImage);
    gl.uniform1i(this.loc.image, 0);
    const useLut = this.texLut && this.lutSize > 0 ? 1 : 0;
    if (useLut) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_3D, this.texLut);
      gl.uniform1i(this.loc.lut, 1);
    }
    gl.uniform1f(this.loc.lutSize, this.lutSize || 0);
    gl.uniform1f(this.loc.useLut, useLut);
    gl.uniform4f(
      this.loc.adj0,
      adj.exposure,
      adj.contrast,
      adj.highlights,
      adj.shadows,
    );
    gl.uniform4f(
      this.loc.adj1,
      adj.temperature,
      adj.tint,
      0,
      0,
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  private initGeometry() {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error("vao");
    this.vao = vao;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    if (!buf) throw new Error("buffer");
    const quad = new Float32Array([
      -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);
  }

  private buildPlaceholderImage(w: number, h: number) {
    const gl = this.gl;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const u = x / (w - 1);
        const v = y / (h - 1);
        data[i] = Math.floor(u * 255);
        data[i + 1] = Math.floor(v * 255);
        data[i + 2] = Math.floor(((u + v) * 0.5) * 255);
        data[i + 3] = 255;
      }
    }
    if (this.texImage) gl.deleteTexture(this.texImage);
    const tex = gl.createTexture();
    if (!tex) throw new Error("tex2d");
    this.texImage = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      w,
      h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private compileShader(type: number, src: string) {
    const gl = this.gl;
    const sh = gl.createShader(type);
    if (!sh) throw new Error("shader");
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) ?? "";
      gl.deleteShader(sh);
      throw new Error(`Shader compile: ${log}`);
    }
    return sh;
  }

  private createProgram(vs: string, fs: string) {
    const gl = this.gl;
    const v = this.compileShader(gl.VERTEX_SHADER, vs);
    const f = this.compileShader(gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram();
    if (!p) throw new Error("program");
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p) ?? "";
      gl.deleteProgram(p);
      throw new Error(`Program link: ${log}`);
    }
    return p;
  }
}
