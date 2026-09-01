import { runHeadlessSimulation } from "../src/simulation/headless-simulation";

const reports = Array.from({ length: 20 }, (_, index) => runHeadlessSimulation(1000 + index));
const victories = reports.filter((report) => report.outcome === "victory").length;
const loops = reports.filter((report) => report.aiLoopDetected).length;
console.log(JSON.stringify({ runs: reports.length, victories, defeats: reports.length - victories - loops, loops, averageRounds: reports.reduce((sum, report) => sum + report.rounds, 0) / reports.length, reports }, null, 2));

