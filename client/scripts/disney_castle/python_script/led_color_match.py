# led_color_match.py

def hex_to_rgb(hex_color):
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return (
        int(hex_color[0:2], 16),
        int(hex_color[2:4], 16),
        int(hex_color[4:6], 16)
    )

def color_distance(rgb1, rgb2):
    """Calculate Euclidean distance between two RGB colors."""
    return ((rgb1[0] - rgb2[0]) ** 2 +
            (rgb1[1] - rgb2[1]) ** 2 +
            (rgb1[2] - rgb2[2]) ** 2) ** 0.5

input_color = data.get('color')
color_map = data.get('color_map')

if not input_color or len(input_color) != 3:
    logger.error("Missing or invalid 'color' input.")
    raise ValueError("Invalid color input")

if not color_map:
    logger.error("Missing or invalid 'color_map' input.")
    raise ValueError("Invalid color map")

# Find closest match
min_dist = float("inf")
closest_entry = None

for name, entry in color_map.items():
    hex_color = entry.get('hex')
    if not hex_color:
        logger.warning(f"Skipping color '{name}' with no hex defined.")
        continue
    rgb = hex_to_rgb(hex_color)
    dist = color_distance(input_color, rgb)

    if dist < min_dist:
        min_dist = dist
        closest_entry = entry

if closest_entry:
    service_domain = closest_entry.get('service_domain')
    service_name = closest_entry.get('service_name')

    if service_domain and service_name:
        logger.info(f"Calling service: {service_domain}.{service_name}")
        hass.services.call(
            service_domain,
            service_name,
            {},
            False
        )
    else:
        logger.error("Closest match found but service info is missing.")
        raise ValueError("Closest service found, but missing service info")
else:
    logger.error(f"No closest color match found for: {input_color}")
    raise ValueError("No match found")
