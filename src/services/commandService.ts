export function processCommand(command: string): {
  action: string;
  url?: string;
  isBrowserAction: boolean;
  setVolume?: number;
} {
  const lowerCmd = command.toLowerCase().trim();

  // 1. Direct percentage matching (e.g., "40%", "80 percent", "40 krdo")
  const percentMatch = lowerCmd.match(/(\d+)\s*(?:%|percent)/);
  if (percentMatch) {
    const vol = parseInt(percentMatch[1], 10);
    if (vol >= 0 && vol <= 100) {
      return {
        action: `Volume ko ${vol}% par set kar diya hai, Abdullah.`,
        isBrowserAction: true,
        setVolume: vol,
      };
    }
  }

  // 2. Generic volume/awaz keyword matching
  const hasVolumeWord =
    lowerCmd.includes("volume") ||
    lowerCmd.includes("awaz") ||
    lowerCmd.includes("awaaz") ||
    lowerCmd.includes("sound") ||
    lowerCmd.includes("audio");

  if (
    hasVolumeWord ||
    lowerCmd.includes("volume up") ||
    lowerCmd.includes("volume down") ||
    lowerCmd.includes("vol up") ||
    lowerCmd.includes("vol down") ||
    lowerCmd.includes("kam karo") ||
    lowerCmd.includes("kam kro") ||
    lowerCmd.includes("badhao")
  ) {
    // Check for explicit mute/silent/unmute keywords
    if (
      lowerCmd.includes("mute") ||
      lowerCmd.includes("silent") ||
      lowerCmd.includes("khamosh") ||
      lowerCmd.includes("chup")
    ) {
      return {
        action: "Volume ko mute kar diya hai, Abdullah.",
        isBrowserAction: true,
        setVolume: 0,
      };
    }

    if (lowerCmd.includes("unmute")) {
      return {
        action: "Volume ko unmute kar diya hai, Abdullah.",
        isBrowserAction: true,
        setVolume: 50,
      };
    }

    if (
      lowerCmd.includes("full") ||
      lowerCmd.includes("maximum") ||
      lowerCmd.includes("max")
    ) {
      return {
        action: "Volume full kar diya hai, Abdullah.",
        isBrowserAction: true,
        setVolume: 100,
      };
    }

    // Match generic numeric patterns like "volume level 40", "volume to 80", "awaz levels ko 50 karo"
    const numMatch =
      lowerCmd.match(
        /(?:volume|awaz|awaaz|sound|level)\s*(?:ko\s*|to\s*|pe\s*|set\s*to\s*|=)?\s*(\d+)/,
      ) || lowerCmd.match(/(\d+)\s*(?:vol|volume|awaz|awaaz|sound)/);

    if (numMatch) {
      const vol = parseInt(numMatch[1], 10);
      if (vol >= 0 && vol <= 100) {
        return {
          action: `Volume ko ${vol}% par set kar diya hai, Abdullah.`,
          isBrowserAction: true,
          setVolume: vol,
        };
      }
    }

    // Handle relative level adjustments if no exact number matches
    const isDecrease =
      lowerCmd.includes("kam") ||
      lowerCmd.includes("down") ||
      lowerCmd.includes("decrease") ||
      lowerCmd.includes("slow") ||
      lowerCmd.includes("halka") ||
      lowerCmd.includes("ghata") ||
      lowerCmd.includes("low");
    const isIncrease =
      lowerCmd.includes("zyada") ||
      lowerCmd.includes("ziada") ||
      lowerCmd.includes("up") ||
      lowerCmd.includes("increase") ||
      lowerCmd.includes("badhao") ||
      lowerCmd.includes("tez") ||
      lowerCmd.includes("high");

    if (isDecrease) {
      return {
        action: "Volume kam kar diya hai, Abdullah.",
        isBrowserAction: true,
        setVolume: -15, // Signal relative reduction
      };
    } else if (isIncrease) {
      return {
        action: "Volume zyada kar diya hai, Abdullah.",
        isBrowserAction: true,
        setVolume: 15, // Signal relative addition
      };
    }
  }

  // General Browsing: "Open [website name]"
  const openMatch = lowerCmd.match(/^open\s+(.+)$/);
  if (
    openMatch &&
    !lowerCmd.includes("youtube") &&
    !lowerCmd.includes("spotify")
  ) {
    let website = openMatch[1].trim().replace(/\s+/g, "");
    if (website.toLowerCase().includes("about:blank") || website.toLowerCase().includes("aboutblank")) {
      return {
        action: `I cannot open about:blank pages, Abdullah. That is reserved.`,
        isBrowserAction: false,
      };
    }
    if (!website.includes(".")) {
      website += ".com";
    }
    return {
      action: `Opening ${openMatch[1]} for you, ugh.`,
      url: `https://www.${website}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Play [song/video] on YouTube"
  const ytMatch = lowerCmd.match(/^play\s+(.+?)\s+on\s+youtube$/);
  if (ytMatch) {
    const query = encodeURIComponent(ytMatch[1].trim());
    return {
      action: `Playing ${ytMatch[1]} on YouTube. Don't judge my music taste.`,
      url: `https://www.youtube.com/results?search_query=${query}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Search [query] on Spotify"
  const spotifyMatch = lowerCmd.match(/^search\s+(.+?)\s+on\s+spotify$/);
  if (spotifyMatch) {
    const query = encodeURIComponent(spotifyMatch[1].trim());
    return {
      action: `Searching ${spotifyMatch[1]} on Spotify. Hope it's a banger.`,
      url: `https://open.spotify.com/search/${query}`,
      isBrowserAction: true,
    };
  }

  // WhatsApp Web: "Send a WhatsApp message to [number] saying [message]"
  const waMatch = lowerCmd.match(
    /^send\s+a\s+whatsapp\s+message\s+to\s+([\d\+\s]+)\s+saying\s+(.+)$/,
  );
  if (waMatch) {
    const number = waMatch[1].replace(/\s+/g, "");
    const message = encodeURIComponent(waMatch[2].trim());
    return {
      action: `Sending your message. Let's hope they reply, Abdullah.`,
      url: `https://web.whatsapp.com/send?phone=${number}&text=${message}`,
      isBrowserAction: true,
    };
  }

  return { action: "", isBrowserAction: false };
}
