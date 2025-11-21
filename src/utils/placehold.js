export const placehold = (w = 88, h = 88, text = 'IMG') =>
  `https://placehold.co/${w}x${h}?text=${encodeURIComponent(text)}`;
