#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform sampler3D u_lut;
uniform float u_lutSize;
uniform float u_useLut;
uniform vec4 u_adj0; // exposure, contrast pivot unused, highlights, shadows
uniform vec4 u_adj1; // temperature (wb mult r), (wb mult g), (wb mult b), tint stub

in vec2 v_uv;
out vec4 outColor;

vec3 applyExposureContrast(vec3 c, float exposure, float contrast) {
  c *= pow(2.0, exposure);
  float pivot = 0.5;
  c = (c - pivot) * (1.0 + contrast) + pivot;
  return clamp(c, 0.0, 1.0);
}

vec3 applyHighlightsShadows(vec3 c, float hi, float sh) {
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 lift = sh * (1.0 - lum) * 0.25;
  vec3 comp = -hi * lum * 0.25;
  return clamp(c + lift + comp, 0.0, 1.0);
}

vec3 applyTempTint(vec3 c, float temp, float tint) {
  vec3 mult = vec3(
    1.0 + temp * 0.004,
    1.0,
    1.0 - temp * 0.004
  );
  mult.g += tint * 0.002;
  mult.r -= tint * 0.002;
  return clamp(c * mult, 0.0, 1.0);
}

void main() {
  vec3 c = texture(u_image, v_uv).rgb;
  c = applyExposureContrast(c, u_adj0.x, u_adj0.y);
  c = applyHighlightsShadows(c, u_adj0.z, u_adj0.w);
  c = applyTempTint(c, u_adj1.x, u_adj1.y);
  if (u_useLut > 0.5 && u_lutSize > 1.5) {
    float n = u_lutSize;
    vec3 coord = c * ((n - 1.0) / n) + 0.5 / n;
    c = texture(u_lut, coord).rgb;
  }
  outColor = vec4(c, 1.0);
}
