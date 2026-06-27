// PortMap — данные (сгенерировано приложением).

window.DATA_VERSION = 1782531726236;

window.VLANS = {
  1: "default",
  2: "FITNES",
  3: "CAMERA",
  4: "FREE-1",
  5: "TRIONIKA",
  7: "KUNDALIK-3",
  8: "ALLGOOD",
  9: "OMEGA",
  10: "OMEGA-SIP",
  11: "AVRORA",
  333: "KUNDALIK-1A",
  334: "KUNDALIK-2A",
  444: "AVOCADO",
  555: "SIROCO",
  666: "WI-FI_GUEST",
  777: "STOP",
  4094: "Management",
};

window.SWITCHES = [
  {
    id: "internet-camera",
    name: "Internet Camera",
    location: "Серверная — основной свитч",
    ports: [
      { port: 1, vlan: 3, ip: "192.168.100.200", mac: "24-0f-9b-2b-9c-a9", host: "NVR-1" },
      { port: 2, vlan: 3, ip: "192.168.100.201", mac: "80-7c-62-11-a2-8a", host: "NVR-2" },
      { port: 3, vlan: 3, ip: "192.168.100.202", mac: "24-0f-9b-2b-9c-49", host: "NVR-3" },
      { port: 4, vlan: 3, ip: "192.168.100.203", mac: "24-0f-9b-2b-9c-3c", host: "NVR-4" },
      { port: 5, vlan: 3, ip: "192.168.100.136", mac: "24-0f-9b-70-4a-09", host: "SECURITY", channel: "D4" },
      { port: 6, vlan: 3, ip: "", mac: "00-15-17-21-b5-3d", host: "Internet Camera" },
      { port: 7, vlan: 1, ip: "192.168.0.199", mac: "f4-b5-49-fb-49-f2", host: "АТС \"Битрикс\" (P560)" },
      { port: 8, vlan: 11, ip: "", mac: "6c-44-2a-65-15-50", host: "DeFactum Uzonline Router" },
      { port: 9, vlan: 1, ip: "192.168.1.222", mac: "60-cf-84-81-77-9c", host: "Proxmox" },
      { port: 10, vlan: 5, ip: "", mac: "", host: "Trionika", off: true },
      { port: 11, vlan: 5, ip: "", mac: "", host: "Trionika", off: true },
      { port: 12, vlan: 3, ip: "192.168.100.130", mac: "e8-a0-ed-87-9c-09", host: "KUHNYA-2", channel: "D20" },
      { port: 13, vlan: 3, ip: "92.168.100.138", mac: "40-ac-bf-8f-24-07", host: "PODVAL SKLAD", channel: "D19" },
      { port: 14, vlan: 3, ip: "", mac: "", host: "", off: true },
      { port: 15, vlan: 2, ip: "", mac: "f4-1d-6b-78-dd-ca", host: "Fitnes" },
      { port: 16, vlan: 10, ip: "", mac: "20-3d-b2-46-b2-a7", host: "OMEGA-SIP", off: true },
      { port: 17, vlan: 7, ip: "", mac: "", host: "KUNDALIK-3", off: true },
      { port: 18, vlan: 9, ip: "", mac: "", host: "OMEGA", off: true },
      { port: 19, vlan: 333, ip: "", mac: "", host: "KUNDALIK-2A", off: true },
      { port: 20, vlan: 333, ip: "", mac: "", host: "KUNDALIK-1A", off: true },
      { port: 21, vlan: 444, ip: "192.168.1.0", mac: "00-15-17-21-b1-1d", host: "AVOCADO", off: true },
      { port: 22, vlan: 1, ip: "192.168.0.200", mac: "9c-5c-8e-d3-c5-87", host: "BiTrend CRM", off: true },
      { port: 23, vlan: 8, ip: "", mac: "", host: "ALLGOOD", off: true },
    ],
  },
  {
    id: "eqw",
    name: "wq",
    location: "weqwe",
    ports: [
    ],
  },
];
