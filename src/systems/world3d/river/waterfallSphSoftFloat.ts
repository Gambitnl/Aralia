/**
 * Integer-based precision candidate for the bounded water arithmetic probe.
 * Adapted from Sienna Meridian Satterwhite's CC0 fp64wgsl, revision
 * 2b1f3ec2041fb4bd9467215756192165e3adda25:
 * https://github.com/siennathesane/fp64wgsl
 *
 * The original source stays in the review evidence. Local changes repair
 * zero-shift, full-word mask and carry propagation boundaries. The probe
 * executes these boundaries and compares arithmetic to an independent CPU
 * oracle before this can be considered for the density solver.
 * DEBT: Experimental only. This is not a qualified general binary64 library
 * or part of the live waterfall; range, rounding and runtime need evidence.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 23:30:49
 * Dependents: systems/world3d/river/waterfallSphPrecisionProbe.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const sphSoftFloatWGSL = /* wgsl */ `// Software IEEE-754 binary64 floating-point arithmetic for WGSL.
// 
// This file contains the type definition, integer helpers, constructors,
// classification, comparisons and integer conversion helpers. It is
// intended to be concatenated with fp64_arith.wgsl and fp64_trig.wgsl.

const FP64_EXPONENT_BIAS: i32 = 1023;
const FP64_EXPONENT_MIN: i32 = -1022;
const FP64_EXPONENT_MAX: i32 = 1023;
const FP64_EXPONENT_SPECIAL: i32 = 1024;
const FP64_MANTISSA_IMPLICIT: u32 = 1u << 20u; // bit 52 in the 53-bit mantissa
const FP64_REF_BIT_ADD: u32 = 60u;

struct Fp64 {
    mantissa_hi: u32,
    mantissa_lo: u32,
    exponent: i32,
    sign: u32,
}

// ---------------------------------------------------------------------------
// 64-bit unsigned integer helpers, stored as (hi, lo).
// ---------------------------------------------------------------------------

alias u64 = vec2<u32>;

fn u64_from_u32(v: u32) -> u64 {
    return u64(0u, v);
}

fn u64_add(a: u64, b: u64) -> u64 {
    let lo = a.y + b.y;
    let carry = select(0u, 1u, lo < a.y);
    let hi = a.x + b.x + carry;
    return u64(hi, lo);
}

fn u64_sub(a: u64, b: u64) -> u64 {
    let lo = a.y - b.y;
    let borrow = select(0u, 1u, a.y < b.y);
    let hi = a.x - b.x - borrow;
    return u64(hi, lo);
}

fn u64_lt(a: u64, b: u64) -> bool {
    if a.x != b.x {
        return a.x < b.x;
    }
    return a.y < b.y;
}

fn u64_gt(a: u64, b: u64) -> bool {
    return !u64_lt(a, b) && !u64_eq(a, b);
}

fn u64_eq(a: u64, b: u64) -> bool {
    return a.x == b.x && a.y == b.y;
}

fn u64_and(a: u64, b: u64) -> u64 {
    return u64(a.x & b.x, a.y & b.y);
}

fn u64_or(a: u64, b: u64) -> u64 {
    return u64(a.x | b.x, a.y | b.y);
}

fn u64_shl_u32(a: u64, n: u32) -> u64 {
    if n == 0u {
        return a;
    }
    if n >= 64u {
        return u64(0u, 0u);
    }
    if n >= 32u {
        let k = n - 32u;
        return u64(a.y << k, 0u);
    }
    let hi = (a.x << n) | (a.y >> (32u - n));
    let lo = a.y << n;
    return u64(hi, lo);
}

fn u64_shr_u32(a: u64, n: u32) -> u64 {
    if n == 0u {
        return a;
    }
    if n >= 64u {
        return u64(0u, 0u);
    }
    if n >= 32u {
        let k = n - 32u;
        return u64(0u, a.x >> k);
    }
    let hi = a.x >> n;
    let lo = (a.x << (32u - n)) | (a.y >> n);
    return u64(hi, lo);
}

// 32x32 -> 64 bit multiplication.
fn mul_u32_u32(a: u32, b: u32) -> u64 {
    let a0 = a & 0xffffu;
    let a1 = a >> 16u;
    let b0 = b & 0xffffu;
    let b1 = b >> 16u;

    let p0 = a0 * b0;
    let p1 = a0 * b1;
    let p2 = a1 * b0;
    let p3 = a1 * b1;

    let mid = (p0 >> 16u) + (p1 & 0xffffu) + (p2 & 0xffffu);
    let hi = p3 + (p1 >> 16u) + (p2 >> 16u) + (mid >> 16u);
    let lo = (mid << 16u) | (p0 & 0xffffu);
    return u64(hi, lo);
}

// Multiply two u64 values, returning a 128-bit result.
fn mul_u64_u64(a: u64, b: u64) -> vec4<u32> {
    let t0 = mul_u32_u32(a.y, b.y);
    let t1a = mul_u32_u32(a.x, b.y);
    let t1b = mul_u32_u32(a.y, b.x);
    let t2 = mul_u32_u32(a.x, b.x);

    // t1a + t1b may overflow 64 bits; capture the carry into the high word.
    let term1_wide = u128_add(u128_from_u64(t1a), u128_from_u64(t1b));
    let term1 = u64(term1_wide.z, term1_wide.w);
    let t1_carry = term1_wide.y;

    let p0 = t0.y;
    let p1_pair = u64_add(vec2(0u, t0.x), vec2(0u, term1.y));
    let p1 = p1_pair.y;
    let c1 = p1_pair.x;

    let p2_temp = u64_add(vec2(0u, term1.x), vec2(0u, t2.y));
    let p2_pair = u64_add(p2_temp, vec2(0u, c1));
    let p2 = p2_pair.y;
    let c2 = p2_pair.x;

    let p3 = t2.x + c2 + t1_carry;

    return vec4(p3, p2, p1, p0);
}

// ---------------------------------------------------------------------------
// 128-bit unsigned helpers, stored as (d, c, b, a) where a is bits 0..31.
// ---------------------------------------------------------------------------

alias u128 = vec4<u32>;

fn u128_zero() -> u128 {
    return vec4(0u, 0u, 0u, 0u);
}

fn u128_is_zero(v: u128) -> bool {
    return v.x == 0u && v.y == 0u && v.z == 0u && v.w == 0u;
}

fn u128_eq(a: u128, b: u128) -> bool {
    return a.x == b.x && a.y == b.y && a.z == b.z && a.w == b.w;
}

fn u128_and(a: u128, b: u128) -> u128 {
    return vec4(a.x & b.x, a.y & b.y, a.z & b.z, a.w & b.w);
}

fn u128_from_u64(v: u64) -> u128 {
    return vec4(0u, 0u, v.x, v.y);
}

fn u128_from_u64_shl(v: u64, n: u32) -> u128 {
    if n >= 128u {
        return u128_zero();
    }
    if n >= 96u {
        if n == 96u { return vec4(v.y, 0u, 0u, 0u); }
        let k = n - 96u;
        return vec4(v.y << k, 0u, 0u, 0u);
    }
    if n >= 64u {
        if n == 64u { return vec4(v.x, v.y, 0u, 0u); }
        let k = n - 64u;
        let hi = (v.x << k) | (v.y >> (32u - k));
        let lo = v.y << k;
        return vec4(hi, lo, 0u, 0u);
    }
    if n >= 32u {
        if n == 32u { return vec4(0u, v.x, v.y, 0u); }
        let k = n - 32u;
        let low_shifted = u64_shl_u32(u64(0u, v.y), k);
        let high_shifted = u64_shl_u32(u64(0u, v.x), k);
        let c_pair = u64_add(u64(0u, low_shifted.x), u64(0u, high_shifted.y));
        let d = high_shifted.x + c_pair.x;
        return vec4(d, c_pair.y, low_shifted.y, 0u);
    }
    let low_shifted = u64_shl_u32(u64(0u, v.y), n);
    let high_shifted = u64_shl_u32(u64(0u, v.x), n);
    let b_pair = u64_add(u64(0u, low_shifted.x), u64(0u, high_shifted.y));
    let c = high_shifted.x + b_pair.x;
    return vec4(0u, c, b_pair.y, low_shifted.y);
}

fn u128_add(a: u128, b: u128) -> u128 {
    let s0 = a.w + b.w;
    let c0 = select(0u, 1u, s0 < a.w);
    let s1 = a.z + b.z + c0;
    let c1 = select(0u, 1u, s1 < a.z || (c0 == 1u && s1 == a.z));
    let s2 = a.y + b.y + c1;
    let c2 = select(0u, 1u, s2 < a.y || (c1 == 1u && s2 == a.y));
    let s3 = a.x + b.x + c2;
    return vec4(s3, s2, s1, s0);
}

fn u128_sub(a: u128, b: u128) -> u128 {
    let d0 = a.w - b.w;
    let b0 = select(0u, 1u, a.w < b.w);
    let d1 = a.z - b.z - b0;
    let b1 = select(0u, 1u, (a.z < b.z) || (a.z == b.z && b0 == 1u));
    let d2 = a.y - b.y - b1;
    let b2 = select(0u, 1u, (a.y < b.y) || (a.y == b.y && b1 == 1u));
    let d3 = a.x - b.x - b2;
    return vec4(d3, d2, d1, d0);
}

fn u128_lt(a: u128, b: u128) -> bool {
    if a.x != b.x { return a.x < b.x; }
    if a.y != b.y { return a.y < b.y; }
    if a.z != b.z { return a.z < b.z; }
    return a.w < b.w;
}

fn u128_shl(v: u128, n: u32) -> u128 {
    if n == 0u { return v; }
    if n >= 128u { return u128_zero(); }
    if n >= 96u {
        if n == 96u { return vec4(v.w, 0u, 0u, 0u); }
        let k = n - 96u;
        return vec4(v.w << k, 0u, 0u, 0u);
    }
    if n >= 64u {
        if n == 64u { return vec4(v.z, v.w, 0u, 0u); }
        let k = n - 64u;
        return vec4(
            (v.z << k) | (v.w >> (32u - k)),
            v.w << k,
            0u,
            0u
        );
    }
    if n >= 32u {
        if n == 32u { return vec4(v.y, v.z, v.w, 0u); }
        let k = n - 32u;
        return vec4(
            (v.y << k) | (v.z >> (32u - k)),
            (v.z << k) | (v.w >> (32u - k)),
            v.w << k,
            0u
        );
    }
    let k = n;
    return vec4(
        (v.x << k) | (v.y >> (32u - k)),
        (v.y << k) | (v.z >> (32u - k)),
        (v.z << k) | (v.w >> (32u - k)),
        v.w << k
    );
}

fn u128_shr(v: u128, n: u32) -> u128 {
    if n == 0u { return v; }
    if n >= 128u { return u128_zero(); }
    let d = v.x;
    let c = v.y;
    let b = v.z;
    let a = v.w;
    if n >= 96u {
        if n == 96u { return vec4(0u, 0u, 0u, d); }
        let k = n - 96u;
        return vec4(0u, 0u, 0u, d >> k);
    }
    if n >= 64u {
        if n == 64u { return vec4(0u, 0u, d, c); }
        let k = n - 64u;
        return vec4(
            0u,
            0u,
            d >> k,
            (c >> k) | (d << (32u - k))
        );
    }
    if n >= 32u {
        if n == 32u { return vec4(0u, d, c, b); }
        let k = n - 32u;
        return vec4(
            0u,
            d >> k,
            (c >> k) | (d << (32u - k)),
            (b >> k) | (c << (32u - k))
        );
    }
    let k = n;
    return vec4(
        d >> k,
        (c >> k) | (d << (32u - k)),
        (b >> k) | (c << (32u - k)),
        (a >> k) | (b << (32u - k))
    );
}

fn u128_leading_bit(v: u128) -> u32 {
    if v.x != 0u { return 96u + 31u - countLeadingZeros(v.x); }
    if v.y != 0u { return 64u + 31u - countLeadingZeros(v.y); }
    if v.z != 0u { return 32u + 31u - countLeadingZeros(v.z); }
    return 31u - countLeadingZeros(v.w);
}

// Extract the low n bits of a u128 as a u64 (n must be <= 64).
fn u128_low_bits_u64(v: u128, n: u32) -> u64 {
    let low64 = vec2(v.z, v.w);
    if n >= 64u { return low64; }
    if n == 0u { return u64(0u, 0u); }
    if n == 32u { return u64(0u, low64.y); }
    if n < 32u {
        let mask = (1u << n) - 1u;
        return u64(0u, low64.y & mask);
    }
    let hi_mask = (1u << (n - 32u)) - 1u;
    return u64(hi_mask & low64.x, low64.y);
}

fn u128_low_u64(v: u128) -> u64 {
    return vec2(v.z, v.w);
}

fn u128_high_u64(v: u128) -> u64 {
    return vec2(v.x, v.y);
}

fn u64_ge(a: u64, b: u64) -> bool {
    return !u64_lt(a, b);
}

// Low n bits of a u64 (0 <= n <= 64).
fn u64_low_bits(v: u64, n: u32) -> u64 {
    if n == 0u {
        return u64(0u, 0u);
    }
    if n >= 64u {
        return v;
    }
    if n == 32u { return u64(0u, v.y); }
    if n < 32u {
        return u64(0u, v.y & ((1u << n) - 1u));
    }
    let hi_mask = (1u << (n - 32u)) - 1u;
    return u64(v.x & hi_mask, v.y);
}

// ---------------------------------------------------------------------------
// 192-bit unsigned helpers, stored as array<u32,6> with index 0 holding bits
// 0..31 and index 5 holding bits 160..191.
// ---------------------------------------------------------------------------

alias u192 = array<u32, 6>;

fn u192_zero() -> u192 {
    return u192(0u, 0u, 0u, 0u, 0u, 0u);
}

fn u192_is_zero(v: u192) -> bool {
    return v[0] == 0u && v[1] == 0u && v[2] == 0u && v[3] == 0u && v[4] == 0u && v[5] == 0u;
}

fn u192_from_u64(v: u64) -> u192 {
    return u192(v.y, v.x, 0u, 0u, 0u, 0u);
}

fn u192_from_u128_u64(high: u128, low: u64) -> u192 {
    return u192(low.y, low.x, high.w, high.z, high.y, high.x);
}

fn u192_add(a: u192, b: u192) -> u192 {
    var out: u192;
    var carry: u32 = 0u;
    for (var i = 0u; i < 6u; i = i + 1u) {
        let s = u64_add(u64(0u, a[i]), u64(0u, b[i]));
        let s2 = u64_add(s, u64(0u, carry));
        out[i] = s2.y;
        carry = s2.x;
    }
    return out;
}

fn u192_sub(a: u192, b: u192) -> u192 {
    var out: u192;
    var borrow: u32 = 0u;
    for (var i = 0u; i < 6u; i = i + 1u) {
        let diff = a[i] - b[i] - borrow;
        let borrow_out = (a[i] < b[i]) || (a[i] == b[i] && borrow == 1u);
        borrow = select(0u, 1u, borrow_out);
        out[i] = diff;
    }
    return out;
}

fn u192_neg(v: u192) -> u192 {
    var out: u192;
    for (var i = 0u; i < 6u; i = i + 1u) {
        out[i] = ~v[i];
    }
    return u192_add(out, u192_from_u64(u64_from_u32(1u)));
}

fn u192_lt(a: u192, b: u192) -> bool {
    if a[5] != b[5] { return a[5] < b[5]; }
    if a[4] != b[4] { return a[4] < b[4]; }
    if a[3] != b[3] { return a[3] < b[3]; }
    if a[2] != b[2] { return a[2] < b[2]; }
    if a[1] != b[1] { return a[1] < b[1]; }
    return a[0] < b[0];
}

fn u192_leading_bit(v: u192) -> u32 {
    if v[5] != 0u { return 160u + 31u - countLeadingZeros(v[5]); }
    if v[4] != 0u { return 128u + 31u - countLeadingZeros(v[4]); }
    if v[3] != 0u { return 96u + 31u - countLeadingZeros(v[3]); }
    if v[2] != 0u { return 64u + 31u - countLeadingZeros(v[2]); }
    if v[1] != 0u { return 32u + 31u - countLeadingZeros(v[1]); }
    return 31u - countLeadingZeros(v[0]);
}

fn u192_shl_u32(v: u192, n: u32) -> u192 {
    if n == 0u {
        return v;
    }
    if n >= 192u {
        return u192_zero();
    }
    let word_shift = n >> 5u;
    let bit_shift = n & 0x1fu;
    var out = u192_zero();
    for (var i = word_shift; i < 6u; i = i + 1u) {
        let j = i - word_shift;
        out[i] = v[j] << bit_shift;
        if j > 0u && bit_shift != 0u {
            out[i] = out[i] | (v[j - 1u] >> (32u - bit_shift));
        }
    }
    return out;
}

fn u192_shr(v: u192, n: u32) -> u192 {
    if n == 0u {
        return v;
    }
    if n >= 192u {
        return u192_zero();
    }
    let word_shift = n >> 5u;
    let bit_shift = n & 0x1fu;
    var out = u192_zero();
    for (var i = word_shift; i < 6u; i = i + 1u) {
        let j = i - word_shift;
        out[j] = v[i] >> bit_shift;
        if i + 1u < 6u && bit_shift != 0u {
            out[j] = out[j] | (v[i + 1u] << (32u - bit_shift));
        }
    }
    return out;
}

fn u192_low_u64(v: u192) -> u64 {
    return u64(v[1], v[0]);
}

// Extract the low n bits of a u192 as a u64 (n must be <= 64).
fn u192_low_bits_u64(v: u192, n: u32) -> u64 {
    if n == 0u { return u64(0u, 0u); }
    if n >= 64u { return u64(v[1], v[0]); }
    if n == 32u { return u64(0u, v[0]); }
    if n < 32u {
        return u64(0u, v[0] & ((1u << n) - 1u));
    }
    let hi_mask = (1u << (n - 32u)) - 1u;
    return u64(v[1] & hi_mask, v[0]);
}

fn u192_test_bit(v: u192, n: u32) -> bool {
    let word = n >> 5u;
    let bit = n & 0x1fu;
    return ((v[word] >> bit) & 1u) == 1u;
}

fn u192_low_bits_are_zero(v: u192, n: u32) -> bool {
    if n == 0u { return true; }
    if n >= 192u { return u192_is_zero(v); }
    let full_words = n >> 5u;
    let rem_bits = n & 0x1fu;
    for (var i = 0u; i < full_words; i = i + 1u) {
        if v[i] != 0u { return false; }
    }
    if rem_bits == 0u { return true; }
    let mask = (1u << rem_bits) - 1u;
    return (v[full_words] & mask) == 0u;
}

// ---------------------------------------------------------------------------
// 256-bit unsigned helpers, stored as array<u32,8> with index 0 holding bits
// 0..31 and index 7 holding bits 224..255.
// ---------------------------------------------------------------------------

alias u256 = array<u32, 8>;

fn u256_zero() -> u256 {
    return u256(0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u);
}

fn u256_is_zero(v: u256) -> bool {
    for (var i = 0u; i < 8u; i = i + 1u) {
        if v[i] != 0u { return false; }
    }
    return true;
}

fn u256_from_u128_u128(low: u128, high: u128) -> u256 {
    return u256(low.w, low.z, low.y, low.x, high.w, high.z, high.y, high.x);
}

fn u256_add(a: u256, b: u256) -> u256 {
    var out: u256;
    var carry: u32 = 0u;
    for (var i = 0u; i < 8u; i = i + 1u) {
        let s = u64_add(u64(0u, a[i]), u64(0u, b[i]));
        let s2 = u64_add(s, u64(0u, carry));
        out[i] = s2.y;
        carry = s2.x;
    }
    return out;
}

fn u256_sub(a: u256, b: u256) -> u256 {
    var out: u256;
    var borrow: u32 = 0u;
    for (var i = 0u; i < 8u; i = i + 1u) {
        let diff = a[i] - b[i] - borrow;
        let borrow_out = (a[i] < b[i]) || (a[i] == b[i] && borrow == 1u);
        borrow = select(0u, 1u, borrow_out);
        out[i] = diff;
    }
    return out;
}

fn u256_lt(a: u256, b: u256) -> bool {
    for (var i = 7u; i > 0u; i = i - 1u) {
        if a[i] != b[i] { return a[i] < b[i]; }
    }
    return a[0] < b[0];
}

fn u256_shl_u32(v: u256, n: u32) -> u256 {
    if n == 0u { return v; }
    if n >= 256u { return u256_zero(); }
    let word_shift = n >> 5u;
    let bit_shift = n & 0x1fu;
    var out = u256_zero();
    for (var i = word_shift; i < 8u; i = i + 1u) {
        let j = i - word_shift;
        out[i] = v[j] << bit_shift;
        if j > 0u && bit_shift != 0u {
            out[i] = out[i] | (v[j - 1u] >> (32u - bit_shift));
        }
    }
    return out;
}

fn u256_shr(v: u256, n: u32) -> u256 {
    if n == 0u { return v; }
    if n >= 256u { return u256_zero(); }
    let word_shift = n >> 5u;
    let bit_shift = n & 0x1fu;
    var out = u256_zero();
    for (var i = word_shift; i < 8u; i = i + 1u) {
        let j = i - word_shift;
        out[j] = v[i] >> bit_shift;
        if i + 1u < 8u && bit_shift != 0u {
            out[j] = out[j] | (v[i + 1u] << (32u - bit_shift));
        }
    }
    return out;
}

fn u256_leading_bit(v: u256) -> u32 {
    for (var i = 7u; i > 0u; i = i - 1u) {
        if v[i] != 0u {
            return (i << 5u) + 31u - countLeadingZeros(v[i]);
        }
    }
    return 31u - countLeadingZeros(v[0]);
}

fn u256_low_u64(v: u256) -> u64 {
    return u64(v[1], v[0]);
}

// Extract the low n bits of a u256 as a u64 (n must be <= 64).
fn u256_low_bits_u64(v: u256, n: u32) -> u64 {
    if n == 0u { return u64(0u, 0u); }
    if n >= 64u { return u64(v[1], v[0]); }
    if n == 32u { return u64(0u, v[0]); }
    if n < 32u {
        return u64(0u, v[0] & ((1u << n) - 1u));
    }
    let hi_mask = (1u << (n - 32u)) - 1u;
    return u64(v[1] & hi_mask, v[0]);
}

fn u256_test_bit(v: u256, n: u32) -> bool {
    let word = n >> 5u;
    let bit = n & 0x1fu;
    return ((v[word] >> bit) & 1u) == 1u;
}

fn u256_low_bits_are_zero(v: u256, n: u32) -> bool {
    if n == 0u { return true; }
    if n >= 256u { return u256_is_zero(v); }
    let full_words = n >> 5u;
    let rem_bits = n & 0x1fu;
    for (var i = 0u; i < full_words; i = i + 1u) {
        if v[i] != 0u { return false; }
    }
    if rem_bits == 0u { return true; }
    let mask = (1u << rem_bits) - 1u;
    return (v[full_words] & mask) == 0u;
}

// Multiply two u128 values, returning a 256-bit result.
fn mul_u128_u128(a: u128, b: u128) -> u256 {
    let a_low = u128_low_u64(a);
    let a_high = u128_high_u64(a);
    let b_low = u128_low_u64(b);
    let b_high = u128_high_u64(b);

    let p0 = u256_from_u128_u128(mul_u64_u64(a_low, b_low), u128_zero());
    let p1 = u256_shl_u32(u256_from_u128_u128(mul_u64_u64(a_low, b_high), u128_zero()), 64u);
    let p2 = u256_shl_u32(u256_from_u128_u128(mul_u64_u64(a_high, b_low), u128_zero()), 64u);
    let p3 = u256_shl_u32(u256_from_u128_u128(mul_u64_u64(a_high, b_high), u128_zero()), 128u);

    var acc = u256_add(p0, p1);
    acc = u256_add(acc, p2);
    acc = u256_add(acc, p3);
    return acc;
}

// ---------------------------------------------------------------------------
// Fp64 constructors and classification
// ---------------------------------------------------------------------------

fn fp64_zero() -> Fp64 {
    return Fp64(0u, 0u, 0, 0u);
}

fn fp64_neg_zero() -> Fp64 {
    return Fp64(0u, 0u, 0, 1u);
}

fn fp64_inf(sign: u32) -> Fp64 {
    return Fp64(0u, 0u, FP64_EXPONENT_SPECIAL, sign & 1u);
}

fn fp64_nan() -> Fp64 {
    return Fp64(0x80000u, 0u, FP64_EXPONENT_SPECIAL, 0u);
}

fn fp64_is_nan(v: Fp64) -> bool {
    return v.exponent == FP64_EXPONENT_SPECIAL && (v.mantissa_hi != 0u || v.mantissa_lo != 0u);
}

fn fp64_is_inf(v: Fp64) -> bool {
    return v.exponent == FP64_EXPONENT_SPECIAL && v.mantissa_hi == 0u && v.mantissa_lo == 0u;
}

fn fp64_is_zero(v: Fp64) -> bool {
    return v.mantissa_hi == 0u && v.mantissa_lo == 0u && v.exponent == 0;
}

fn fp64_mantissa(v: Fp64) -> u64 {
    return u64(v.mantissa_hi, v.mantissa_lo);
}

fn fp64_from_f32(v: f32) -> Fp64 {
    let bits = bitcast<u32>(v);
    let sign = (bits >> 31u) & 1u;
    let stored_exp = (bits >> 23u) & 0xffu;
    let frac = bits & 0x7fffffu;

    if stored_exp == 0u {
        if frac == 0u {
            if sign == 0u {
                return fp64_zero();
            }
            return fp64_neg_zero();
        }
        let p = 31u - countLeadingZeros(frac);
        let shift = 52u - p;
        let mantissa = u64_shl_u32(u64(0u, frac), shift);
        let exponent = i32(p) - 149;
        return Fp64(mantissa.x, mantissa.y, exponent, sign);
    }
    if stored_exp == 255u {
        if frac == 0u {
            return fp64_inf(sign);
        }
        return fp64_nan();
    }
    let mantissa = u64_shl_u32(u64(0u, (1u << 23u) | frac), 29u);
    let exponent = i32(stored_exp) - 127;
    return Fp64(mantissa.x, mantissa.y, exponent, sign);
}


fn fp64_lt(a: Fp64, b: Fp64) -> bool {
    if fp64_is_nan(a) || fp64_is_nan(b) { return false; }
    if fp64_is_zero(a) && fp64_is_zero(b) { return false; }
    if a.sign != b.sign {
        return a.sign == 1u;
    }
    if a.exponent != b.exponent {
        if a.sign == 0u { return a.exponent < b.exponent; }
        return a.exponent > b.exponent;
    }
    let ma = fp64_mantissa(a);
    let mb = fp64_mantissa(b);
    if a.sign == 0u { return u64_lt(ma, mb); }
    return u64_lt(mb, ma);
}

fn fp64_le(a: Fp64, b: Fp64) -> bool {
    return fp64_lt(a, b) || fp64_eq(a, b);
}

fn fp64_gt(a: Fp64, b: Fp64) -> bool {
    return fp64_lt(b, a);
}

fn fp64_ge(a: Fp64, b: Fp64) -> bool {
    return fp64_le(b, a);
}

fn fp64_eq(a: Fp64, b: Fp64) -> bool {
    if fp64_is_nan(a) || fp64_is_nan(b) { return false; }
    if fp64_is_zero(a) && fp64_is_zero(b) { return true; }
    return a.sign == b.sign && a.exponent == b.exponent &&
           a.mantissa_hi == b.mantissa_hi && a.mantissa_lo == b.mantissa_lo;
}

// ---------------------------------------------------------------------------
// Integer conversion helpers
// ---------------------------------------------------------------------------

fn fp64_from_i32(v: i32) -> Fp64 {
    if v == 0 {
        return fp64_zero();
    }
    let sign = select(0u, 1u, v < 0);
    var uv = u32(v);
    if v < 0 {
        uv = u32(-v);
    }
    let p = 31u - countLeadingZeros(uv);
    let shift = 52u - p;
    let mantissa = u64_shl_u32(u64(0u, uv), shift);
    return Fp64(mantissa.x, mantissa.y, i32(p), sign);
}

// Round a finite Fp64 value to the nearest i32. Caller must ensure the value
// is within i32 range and non-negative.
fn fp64_round_to_i32(v: Fp64) -> i32 {
    let half = Fp64(0x00100000u, 0u, -1, 0u); // 0.5
    let rounded = fp64_add(v, half);
    let m = fp64_mantissa(rounded);
    let exp = rounded.exponent;
    if exp < 0 {
        return 0;
    }
    if exp >= 52 {
        return 2147483647;
    }
    let shift = 52u - u32(exp);
    let m_shifted = u64_shr_u32(m, shift);
    if m_shifted.x != 0u {
        return 2147483647;
    }
    return i32(m_shifted.y);
}

// Software IEEE-754 binary64 arithmetic operations.
// 
// Normalize, add, sub, mul, div, sqrt and basic unary helpers.

// Normalization
// ---------------------------------------------------------------------------

const FP64_MANTISSA_MASK: u64 = u64(0x1fffffu, 0xffffffffu);

fn leading_zero_count_u64(v: u64) -> u32 {
    if v.x != 0u {
        return countLeadingZeros(v.x);
    }
    return 32u + countLeadingZeros(v.y);
}

fn round_to_nearest_even(mantissa: u64, remainder: u64, half_ulp: u64) -> u64 {
    var result = mantissa;
    let round_up = u64_gt(remainder, half_ulp) ||
                   (u64_eq(remainder, half_ulp) && (result.y & 1u) == 1u);
    if round_up {
        result = u64_add(result, u64_from_u32(1u));
    }
    return result;
}

// General normalization from a 128-bit integer.
// \`value\` represents the unrounded result scaled by 2^ref_bit, i.e. the real
// value is value * 2^(exponent - 52 - ref_bit).
fn fp64_normalize_u128(sign: u32, exponent: i32, value: u128, ref_bit: u32) -> Fp64 {
    if u128_is_zero(value) {
        return fp64_zero();
    }

    let L = u128_leading_bit(value);
    var e = exponent + i32(L) - i32(ref_bit) - 52;

    // Overflow to infinity.
    if e > FP64_EXPONENT_MAX {
        return fp64_inf(sign);
    }

    // Underflow into the denormal range.
    if e < FP64_EXPONENT_MIN {
        let total_shift = u32(i32(ref_bit) + FP64_EXPONENT_MIN - exponent);
        if total_shift >= 128u {
            return Fp64(0u, 0u, 0, sign & 1u);
        }

        let mantissa = u128_shr(value, total_shift);
        var m = u64_and(u128_low_u64(mantissa), FP64_MANTISSA_MASK);

        if total_shift <= 64u {
            let remainder = u128_low_bits_u64(value, total_shift);
            let half_ulp = u64_shl_u32(u64_from_u32(1u), total_shift - 1u);
            m = round_to_nearest_even(m, remainder, half_ulp);
        }

        // If rounding pushed the mantissa to 2^52 it becomes a normal number.
        if m.x == FP64_MANTISSA_IMPLICIT && m.y == 0u {
            return Fp64(m.x, m.y, FP64_EXPONENT_MIN, sign & 1u);
        }
        return Fp64(m.x, m.y, FP64_EXPONENT_MIN, sign & 1u);
    }

    if L >= 52u {
        let shift = L - 52u;
        let shifted = u128_shr(value, shift);
        var m = u64_and(u128_low_u64(shifted), FP64_MANTISSA_MASK);

        if shift > 0u {
            let remainder = u128_low_bits_u64(value, shift);
            let half_ulp = u64_shl_u32(u64_from_u32(1u), shift - 1u);
            m = round_to_nearest_even(m, remainder, half_ulp);
        }

        if m.x == (FP64_MANTISSA_IMPLICIT << 1u) && m.y == 0u {
            m = u64(FP64_MANTISSA_IMPLICIT, 0u);
            if e + 1 > FP64_EXPONENT_MAX {
                return fp64_inf(sign);
            }
            return Fp64(m.x, m.y, e + 1, sign & 1u);
        }

        return Fp64(m.x, m.y, e, sign & 1u);
    }

    // L < 52: shift left to place the implicit bit at position 52. No bits are
    // discarded, so rounding is not required.
    let shift = 52u - L;
    let shifted = u128_shl(value, shift);
    let m = u64_and(u128_low_u64(shifted), FP64_MANTISSA_MASK);
    return Fp64(m.x, m.y, e, sign & 1u);
}

// General normalization from a 192-bit integer.
// \`value\` represents the unrounded result scaled by 2^ref_bit, i.e. the real
// value is value * 2^(exponent - 52 - ref_bit).
fn fp64_normalize_u192(sign: u32, exponent: i32, value: u192, ref_bit: u32) -> Fp64 {
    if u192_is_zero(value) {
        return fp64_zero();
    }

    let L = u192_leading_bit(value);
    var e = exponent + i32(L) - i32(ref_bit) - 52;

    // Overflow to infinity.
    if e > FP64_EXPONENT_MAX {
        return fp64_inf(sign);
    }

    // Underflow into the denormal range.
    if e < FP64_EXPONENT_MIN {
        let total_shift = u32(i32(ref_bit) + FP64_EXPONENT_MIN - exponent);
        if total_shift >= 192u {
            return Fp64(0u, 0u, 0, sign & 1u);
        }

        let mantissa = u192_shr(value, total_shift);
        var m = u64_and(u192_low_u64(mantissa), FP64_MANTISSA_MASK);

        if total_shift <= 64u {
            let remainder = u192_low_bits_u64(value, total_shift);
            let half_ulp = u64_shl_u32(u64_from_u32(1u), total_shift - 1u);
            m = round_to_nearest_even(m, remainder, half_ulp);
        }

        // If rounding pushed the mantissa to 2^52 it becomes a normal number.
        if m.x == FP64_MANTISSA_IMPLICIT && m.y == 0u {
            return Fp64(m.x, m.y, FP64_EXPONENT_MIN, sign & 1u);
        }
        return Fp64(m.x, m.y, FP64_EXPONENT_MIN, sign & 1u);
    }

    if L >= 52u {
        let shift = L - 52u;
        let shifted = u192_shr(value, shift);
        var m = u64_and(u192_low_u64(shifted), FP64_MANTISSA_MASK);

        if shift > 0u {
            if shift >= 64u {
                // The half-ulp bit does not fit in a u64; decide rounding from
                // the discarded bits of the full u192 value.
                let half_bit = shift - 1u;
                if u192_test_bit(value, half_bit) {
                    let lower_bits_zero = u192_low_bits_are_zero(value, half_bit);
                    let round_up = !lower_bits_zero || (m.y & 1u) == 1u;
                    if round_up {
                        m = u64_add(m, u64_from_u32(1u));
                    }
                }
            } else {
                let remainder = u192_low_bits_u64(value, shift);
                let half_ulp = u64_shl_u32(u64_from_u32(1u), shift - 1u);
                m = round_to_nearest_even(m, remainder, half_ulp);
            }
        }

        if m.x == (FP64_MANTISSA_IMPLICIT << 1u) && m.y == 0u {
            m = u64(FP64_MANTISSA_IMPLICIT, 0u);
            if e + 1 > FP64_EXPONENT_MAX {
                return fp64_inf(sign);
            }
            return Fp64(m.x, m.y, e + 1, sign & 1u);
        }

        return Fp64(m.x, m.y, e, sign & 1u);
    }

    // L < 52: shift left to place the implicit bit at position 52. No bits are
    // discarded, so rounding is not required.
    let shift = 52u - L;
    let shifted = u192_shl_u32(value, shift);
    let m = u64_and(u192_low_u64(shifted), FP64_MANTISSA_MASK);
    return Fp64(m.x, m.y, e, sign & 1u);
}

// General normalization from a 256-bit integer.
// \`value\` represents the unrounded result scaled by 2^ref_bit.
fn fp64_normalize_u256(sign: u32, exponent: i32, value: u256, ref_bit: u32) -> Fp64 {
    if u256_is_zero(value) {
        return fp64_zero();
    }

    let L = u256_leading_bit(value);
    var e = exponent + i32(L) - i32(ref_bit) - 52;

    // Overflow to infinity.
    if e > FP64_EXPONENT_MAX {
        return fp64_inf(sign);
    }

    // Underflow into the denormal range.
    if e < FP64_EXPONENT_MIN {
        let total_shift = u32(i32(ref_bit) + FP64_EXPONENT_MIN - exponent);
        if total_shift >= 256u {
            return Fp64(0u, 0u, 0, sign & 1u);
        }

        let mantissa = u256_shr(value, total_shift);
        var m = u64_and(u256_low_u64(mantissa), FP64_MANTISSA_MASK);

        if total_shift <= 64u {
            let remainder = u256_low_bits_u64(value, total_shift);
            let half_ulp = u64_shl_u32(u64_from_u32(1u), total_shift - 1u);
            m = round_to_nearest_even(m, remainder, half_ulp);
        }

        if m.x == FP64_MANTISSA_IMPLICIT && m.y == 0u {
            return Fp64(m.x, m.y, FP64_EXPONENT_MIN, sign & 1u);
        }
        return Fp64(m.x, m.y, FP64_EXPONENT_MIN, sign & 1u);
    }

    if L >= 52u {
        let shift = L - 52u;
        let shifted = u256_shr(value, shift);
        var m = u64_and(u256_low_u64(shifted), FP64_MANTISSA_MASK);

        if shift > 0u {
            if shift >= 64u {
                let half_bit = shift - 1u;
                if u256_test_bit(value, half_bit) {
                    let lower_bits_zero = u256_low_bits_are_zero(value, half_bit);
                    let round_up = !lower_bits_zero || (m.y & 1u) == 1u;
                    if round_up {
                        m = u64_add(m, u64_from_u32(1u));
                    }
                }
            } else {
                let remainder = u256_low_bits_u64(value, shift);
                let half_ulp = u64_shl_u32(u64_from_u32(1u), shift - 1u);
                m = round_to_nearest_even(m, remainder, half_ulp);
            }
        }

        if m.x == (FP64_MANTISSA_IMPLICIT << 1u) && m.y == 0u {
            m = u64(FP64_MANTISSA_IMPLICIT, 0u);
            if e + 1 > FP64_EXPONENT_MAX {
                return fp64_inf(sign);
            }
            return Fp64(m.x, m.y, e + 1, sign & 1u);
        }

        return Fp64(m.x, m.y, e, sign & 1u);
    }

    let shift = 52u - L;
    let shifted = u256_shl_u32(value, shift);
    let m = u64_and(u256_low_u64(shifted), FP64_MANTISSA_MASK);
    return Fp64(m.x, m.y, e, sign & 1u);
}

// ---------------------------------------------------------------------------
// Basic unary operations
// ---------------------------------------------------------------------------

fn fp64_neg(a: Fp64) -> Fp64 {
    var out = a;
    out.sign ^= 1u;
    return out;
}

fn fp64_abs(a: Fp64) -> Fp64 {
    var out = a;
    out.sign = 0u;
    return out;
}

// ---------------------------------------------------------------------------
// Addition and subtraction
// ---------------------------------------------------------------------------

fn fp64_add(a: Fp64, b: Fp64) -> Fp64 {
    if fp64_is_nan(a) || fp64_is_nan(b) {
        return fp64_nan();
    }

    if fp64_is_inf(a) {
        if fp64_is_inf(b) && a.sign != b.sign {
            return fp64_nan();
        }
        return fp64_inf(a.sign);
    }
    if fp64_is_inf(b) {
        return fp64_inf(b.sign);
    }

    if fp64_is_zero(a) {
        if fp64_is_zero(b) {
            // +0 + -0 = +0; same sign keeps that sign.
            return Fp64(0u, 0u, 0, a.sign & b.sign);
        }
        return b;
    }
    if fp64_is_zero(b) {
        return a;
    }

    // Work with the operand that has the larger exponent as \`av\`.
    var av = a;
    var bv = b;
    if a.exponent < b.exponent {
        av = b;
        bv = a;
    }
    let exp_diff = u32(av.exponent - bv.exponent);

    let mx = fp64_mantissa(av);
    let my = fp64_mantissa(bv);

    // If the smaller operand is too small to affect the result, drop it.
    if exp_diff >= 128u {
        return av;
    }

    var large = u128_from_u64_shl(mx, FP64_REF_BIT_ADD);
    var small = u128_from_u64_shl(my, FP64_REF_BIT_ADD);
    if exp_diff > 0u {
        small = u128_shr(small, exp_diff);
    }

    if av.sign == bv.sign {
        let sum = u128_add(large, small);
        return fp64_normalize_u128(av.sign, av.exponent, sum, FP64_REF_BIT_ADD);
    }

    if u128_lt(large, small) {
        let diff = u128_sub(small, large);
        return fp64_normalize_u128(bv.sign, bv.exponent, diff, FP64_REF_BIT_ADD);
    }

    let diff = u128_sub(large, small);
    return fp64_normalize_u128(av.sign, av.exponent, diff, FP64_REF_BIT_ADD);
}

fn fp64_sub(a: Fp64, b: Fp64) -> Fp64 {
    return fp64_add(a, fp64_neg(b));
}

// ---------------------------------------------------------------------------
// Multiplication
// ---------------------------------------------------------------------------

fn fp64_mul(a: Fp64, b: Fp64) -> Fp64 {
    if fp64_is_nan(a) || fp64_is_nan(b) {
        return fp64_nan();
    }
    if fp64_is_inf(a) || fp64_is_inf(b) {
        if fp64_is_zero(a) || fp64_is_zero(b) {
            return fp64_nan();
        }
        return fp64_inf(a.sign ^ b.sign);
    }
    if fp64_is_zero(a) || fp64_is_zero(b) {
        return Fp64(0u, 0u, 0, a.sign ^ b.sign);
    }

    let sign = a.sign ^ b.sign;
    let mx = fp64_mantissa(a);
    let my = fp64_mantissa(b);

    let product = mul_u64_u64(mx, my);
    let exponent = a.exponent + b.exponent;

    return fp64_normalize_u128(sign, exponent, product, 52u);
}

// ---------------------------------------------------------------------------
// Division
// ---------------------------------------------------------------------------

fn fp64_div(a: Fp64, b: Fp64) -> Fp64 {
    if fp64_is_nan(a) || fp64_is_nan(b) {
        return fp64_nan();
    }
    if fp64_is_inf(a) && fp64_is_inf(b) {
        return fp64_nan();
    }
    if fp64_is_inf(a) {
        return fp64_inf(a.sign ^ b.sign);
    }
    if fp64_is_inf(b) {
        return Fp64(0u, 0u, 0, a.sign ^ b.sign);
    }
    if fp64_is_zero(b) {
        if fp64_is_zero(a) {
            return fp64_nan();
        }
        return fp64_inf(a.sign ^ b.sign);
    }
    if fp64_is_zero(a) {
        return Fp64(0u, 0u, 0, a.sign ^ b.sign);
    }

    let sign = a.sign ^ b.sign;
    let mx = fp64_mantissa(a);
    let my = fp64_mantissa(b);

    // Normal numbers already have bit 52 set. Subnormals do not, so shift them
    // left until the implicit bit is set and compensate the exponent.
    let mx_shift = leading_zero_count_u64(mx) - 11u;
    let my_shift = leading_zero_count_u64(my) - 11u;
    let mx_norm = u64_shl_u32(mx, mx_shift);
    let my_norm = u64_shl_u32(my, my_shift);

    // Compute q = floor(mx_norm * 2^57 / my_norm) using binary long division.
    // The dividend is aligned so that the first quotient bit (weight 2^57)
    // is decided by comparing mx_norm against my_norm.
    var remainder = u128_from_u64_shl(mx_norm, 64u);
    let divisor = my_norm;
    var quotient = u64(0u, 0u);

    for (var i = 0u; i < 58u; i = i + 1u) {
        quotient = u64_shl_u32(quotient, 1u);
        // Compare remainder (bits 64..127) with divisor.
        let remainder_hi = u64(remainder.x, remainder.y);
        if !u64_lt(remainder_hi, divisor) {
            remainder = u128_sub(remainder, u128_from_u64_shl(divisor, 64u));
            quotient = u64_add(quotient, u64_from_u32(1u));
        }
        remainder = u128_shl(remainder, 1u);
    }

    // The loop produced the floor quotient. Round to nearest even using the
    // true remainder of mx_norm * 2^57 divided by my_norm; the low bits of the
    // floor quotient alone are not a reliable rounding indicator.
    let dividend = u128_from_u64_shl(mx_norm, 57u);
    let q_times_divisor = mul_u64_u64(quotient, my_norm);
    let actual_remainder = u128_sub(dividend, q_times_divisor);

    let quotient_u128 = u128_from_u64(quotient);
    let L = u128_leading_bit(quotient_u128);
    let shift = L - 52u;
    var mantissa = u64_shr_u32(quotient, shift);

    let low_q = quotient.y & ((1u << shift) - 1u);
    let threshold = 1u << (shift - 1u);
    let lhs = u64_add(
        u128_low_u64(mul_u64_u64(u64(0u, low_q), my_norm)),
        u128_low_u64(actual_remainder)
    );
    let rhs = u128_low_u64(mul_u64_u64(u64(0u, threshold), my_norm));

    if u64_gt(lhs, rhs) || (u64_eq(lhs, rhs) && (mantissa.y & 1u) == 1u) {
        mantissa = u64_add(mantissa, u64_from_u32(1u));
    }

    var e = a.exponent - b.exponent - i32(mx_shift) + i32(my_shift) + i32(L) - 57;

    // Rounding may have overflowed the mantissa into the implicit bit.
    if mantissa.x == (FP64_MANTISSA_IMPLICIT << 1u) && mantissa.y == 0u {
        mantissa = u64(FP64_MANTISSA_IMPLICIT, 0u);
        e = e + 1;
    }

    // Overflow to infinity.
    if e > FP64_EXPONENT_MAX {
        return fp64_inf(sign);
    }

    // Underflow into the denormal range.
    if e < FP64_EXPONENT_MIN {
        let total_shift = u32(FP64_EXPONENT_MIN - e);
        if total_shift >= 64u {
            return Fp64(0u, 0u, 0, sign & 1u);
        }

        let shifted = u64_shr_u32(mantissa, total_shift);
        var m = u64_and(shifted, FP64_MANTISSA_MASK);

        if total_shift <= 32u {
            let remainder_den = u64(0u, mantissa.y & ((1u << total_shift) - 1u));
            let half_ulp = u64(0u, 1u << (total_shift - 1u));
            m = round_to_nearest_even(m, remainder_den, half_ulp);
        } else {
            let low_mask = (1u << (total_shift - 32u)) - 1u;
            let remainder_den = u64(mantissa.y & low_mask, mantissa.x);
            let half_ulp_hi = 1u << (total_shift - 32u - 1u);
            let half_ulp = u64(half_ulp_hi, 0u);
            m = round_to_nearest_even(m, remainder_den, half_ulp);
        }

        if m.x == FP64_MANTISSA_IMPLICIT && m.y == 0u {
            return Fp64(m.x, m.y, FP64_EXPONENT_MIN, sign & 1u);
        }
        return Fp64(m.x, m.y, FP64_EXPONENT_MIN, sign & 1u);
    }

    let m = u64_and(mantissa, FP64_MANTISSA_MASK);
    return Fp64(m.x, m.y, e, sign & 1u);
}

// ---------------------------------------------------------------------------
// Square root
// ---------------------------------------------------------------------------

fn fp64_sqrt(a: Fp64) -> Fp64 {
    if fp64_is_nan(a) {
        return fp64_nan();
    }
    if a.sign == 1u && !fp64_is_zero(a) {
        return fp64_nan();
    }
    if fp64_is_inf(a) {
        return fp64_inf(0u);
    }
    if fp64_is_zero(a) {
        return Fp64(0u, 0u, 0, a.sign);
    }

    let mx = fp64_mantissa(a);

    // Normal numbers already have bit 52 set. Subnormals do not, so shift them
    // left until the implicit bit is set and compensate the exponent.
    let mx_shift = leading_zero_count_u64(mx) - 11u;
    let mx_norm = u64_shl_u32(mx, mx_shift);
    let exponent = a.exponent - i32(mx_shift);

    var result_exponent: i32;
    var radicand_mantissa: u64;
    if (exponent & 1) == 0 {
        result_exponent = exponent / 2;
        radicand_mantissa = mx_norm;
    } else {
        result_exponent = (exponent - 1) / 2;
        radicand_mantissa = u64_shl_u32(mx_norm, 1u);
    }

    let radicand = u128_from_u64_shl(radicand_mantissa, 54u);
    let radicand_top = u128_leading_bit(radicand);
    var shift: i32;
    var remainder = u64(0u, 0u);
    var result = u64(0u, 0u);
    var loop_count: u32;
    // If the top bit is at an even position, the first group contains only that
    // single 1 bit. Otherwise the first group is a pair.
    if (radicand_top & 1u) == 0u {
        result = u64_from_u32(1u);
        shift = i32(radicand_top) - 2;
        loop_count = 53u;
    } else {
        shift = i32(radicand_top) - 1;
        loop_count = 54u;
    }

    for (var i = 0u; i < loop_count; i = i + 1u) {
        result = u64_shl_u32(result, 1u);
        remainder = u64_shl_u32(remainder, 2u);
        var next_two: u64;
        if shift >= 0 {
            next_two = u128_low_bits_u64(u128_shr(radicand, u32(shift)), 2u);
        } else if shift == -1 {
            next_two = u128_low_bits_u64(radicand, 1u);
        } else {
            next_two = u64(0u, 0u);
        }
        remainder = u64_add(remainder, next_two);
        shift -= 2;
        let d = u64_add(u64_shl_u32(result, 1u), u64_from_u32(1u));
        if !u64_lt(remainder, d) {
            remainder = u64_sub(remainder, d);
            result = u64_add(result, u64_from_u32(1u));
        }
    }

    // result is in [2^53, 2^54). The true sqrt is between result and result+1.
    let round_bit = result.y & 1u;
    var m = u64_shr_u32(result, 1u);
    let result_sq = mul_u64_u64(result, result);
    let is_exact = u128_eq(result_sq, radicand);
    let round_up = (round_bit == 1u) && (!is_exact || (m.y & 1u) == 1u);
    if round_up {
        m = u64_add(m, u64_from_u32(1u));
    }
    if m.x == (FP64_MANTISSA_IMPLICIT << 1u) && m.y == 0u {
        m = u64(FP64_MANTISSA_IMPLICIT, 0u);
        result_exponent += 1;
    }

    return Fp64(m.x, m.y, result_exponent, 0u);
}
`;
