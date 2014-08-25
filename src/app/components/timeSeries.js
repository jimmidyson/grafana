define([
  'lodash',
  'kbn'
],
function (_, kbn) {
  'use strict';

  function TimeSeries(opts) {
    this.datapoints = opts.datapoints;
    this.info = opts.info;
    this.label = opts.info.alias;
  }

  function matchSeriesOverride(aliasOrRegex, seriesAlias) {
    if (!aliasOrRegex) { return false; }

    if (aliasOrRegex[0] === '/') {
      var match = aliasOrRegex.match(new RegExp('^/(.*?)/(g?i?m?y?)$'));
      var regex = new RegExp(match[1], match[2]);
      return seriesAlias.match(regex) != null;
    }

    return aliasOrRegex === seriesAlias;
  }

  function translateFillOption(fill) {
    return fill === 0 ? 0.001 : fill/10;
  }

  TimeSeries.prototype.applySeriesOverrides = function(overrides) {
    this.lines = {};
    this.points = {};
    this.bars = {};
    this.info.yaxis = 1;
    this.zindex = 0;
    delete this.stack;

    for (var i = 0; i < overrides.length; i++) {
      var override = overrides[i];
      if (!matchSeriesOverride(override.alias, this.info.alias)) {
        continue;
      }
      if (override.lines !== void 0) { this.lines.show = override.lines; }
      if (override.points !== void 0) { this.points.show = override.points; }
      if (override.bars !== void 0) { this.bars.show = override.bars; }
      if (override.fill !== void 0) { this.lines.fill = translateFillOption(override.fill); }
      if (override.stack !== void 0) { this.stack = override.stack; }
      if (override.linewidth !== void 0) { this.lines.lineWidth = override.linewidth; }
      if (override.pointradius !== void 0) { this.points.radius = override.pointradius; }
      if (override.steppedLine !== void 0) { this.lines.steps = override.steppedLine; }
      if (override.zindex !== void 0) { this.zindex = override.zindex; }
      if (override.yaxis !== void 0) {
        this.info.yaxis = override.yaxis;
      }
    }
  };

  TimeSeries.prototype.getFlotPairs = function (fillStyle, yFormats) {
    var result = [];

    this.color = this.info.color;
    this.yaxis = this.info.yaxis;

    this.info.total = 0;
    this.info.max = -212312321312;
    this.info.min = 212312321312;

    var ignoreNulls = fillStyle === 'connected';
    var nullAsZero = fillStyle === 'null as zero';
    var currentTime;
    var currentValue;

    if (fillStyle === 'insert zero') {
      this.fillMissingValuesWithZero();
    }

    for (var i = 0; i < this.datapoints.length; i++) {
      currentValue = this.datapoints[i][0];
      currentTime = this.datapoints[i][1];

      if (currentValue === null) {
        if (ignoreNulls) { continue; }
        if (nullAsZero) {
          currentValue = 0;
        }
      }

      if (_.isNumber(currentValue)) {
        this.info.total += currentValue;
      }

      if (currentValue > this.info.max) {
        this.info.max = currentValue;
      }

      if (currentValue < this.info.min) {
        this.info.min = currentValue;
      }

      result.push([currentTime * 1000, currentValue]);
    }

    if (result.length > 2) {
      this.info.timeStep = result[1][0] - result[0][0];
    }

    if (result.length) {

      this.info.avg = (this.info.total / result.length);
      this.info.current = result[result.length-1][1];

      var formater = kbn.getFormatFunction(yFormats[this.yaxis - 1], 2);
      this.info.avg = this.info.avg != null ? formater(this.info.avg) : null;
      this.info.current = this.info.current != null ? formater(this.info.current) : null;
      this.info.min = this.info.min != null ? formater(this.info.min) : null;
      this.info.max = this.info.max != null ? formater(this.info.max) : null;
      this.info.total = this.info.total != null ? formater(this.info.total) : null;
    }

    return result;
  };

  TimeSeries.prototype.fillMissingValuesWithZero = function() {
    var pointDist = this.guessPointDistance();
    if (pointDist === 0) {
      console.log("Cannot guess point distance, aborting zero insert attempt");
      return;
    }

    var i, currentDist, start, base;
    var newpoints = [];
    newpoints.push(this.datapoints[0]);

    for (i = 1; i < this.datapoints.length; i++) {
      start = this.datapoints[i][1];
      base = this.datapoints[i - 1][1];
      currentDist = start - base;
      while (currentDist > pointDist) {
        base += pointDist;
        currentDist -= pointDist;
        newpoints.push([0, base]);
      }
      newpoints.push(this.datapoints[i]);
    }

    this.datapoints = newpoints;
  };

  TimeSeries.prototype.guessPointDistance = function() {
    var prevDist, currentDist, sameCount, i;
    prevDist = currentDist = sameCount = 0;

    for (i = 1; i < this.datapoints.length; i++) {
      currentDist = this.datapoints[i][1] - this.datapoints[i - 1][1];
      if (currentDist === prevDist) {
        sameCount++;
      }
      else {
        prevDist = currentDist;
        sameCount = 1;
      }
      if (sameCount === 2) {
        break;
      }
    }

    return sameCount === 2 ? prevDist : 0;
  };

  return TimeSeries;

});