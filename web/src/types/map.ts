
import type {BBox, Feature, Polygon, Point, Position, LineString} from 'geojson';
import {MapArea, Point32} from "../types/ros.ts";

import {transpose} from "../utils/map.tsx";

export class MowingFeature {
    id: string;
    type: 'Feature';

    constructor(id: string) {
        this.type = 'Feature';
        this.id = id;
    }
}

export class PointFeatureBase extends MowingFeature implements Feature<Point>  {

    geometry: Point;
    properties: {
        color: string,
        feature_type: string
    }

    constructor(id: string, coordinate: Position, feature_type:string) {
        super(id);
        
        this.properties = { 
            color : 'black',
            feature_type: feature_type
        };
        this.geometry = {type:'Point', coordinates: coordinate} as Point;
    }

    setColor(color:string) {
        this.properties.color = color;
    }
}

export class LineFeatureBase extends MowingFeature implements Feature<LineString>  {

    geometry: LineString;
    properties: {
        color: string,
        width: number,
        feature_type: string
    }

    constructor(id: string, coordinates: Position[], color: string, feature_type:string) {
        super(id);
        
        this.properties = { 
            color : color,
            width : 1,
            feature_type: feature_type
        };
        this.geometry = {type:'LineString', coordinates: coordinates} as LineString;
    }
}

export class PathFeature extends LineFeatureBase {
    constructor(id: string, coordinates: Position[], color: string, lineWidth = 1) {
        super(id, coordinates,color, 'path');
        this.properties.width = lineWidth;
    }
}

export class ActivePathFeature extends LineFeatureBase {
    constructor(id: string, coordinates: Position[]) {
        super(id, coordinates, 'orange', 'active_path');
        this.properties.width = 3;
    }
}

export class MowerFeatureBase extends PointFeatureBase  {
    constructor(coordinate: Position) {
        super('mower', coordinate,'mower');
        this.setColor('#00a6ff');
    }
}

export class DockFeatureBase extends PointFeatureBase  {
    constructor(coordinate: Position) {
        super('dock', coordinate,'dock');
        this.setColor('#ff00f2');
    }
}


export class MowingFeatureBase extends MowingFeature implements Feature<Polygon> {
    geometry: Polygon;

    properties: {
        color: string
        , name? :string
        , index: number
        , mowing_order: number
        , feature_type: string
    }
    bbox?: BBox | undefined;

    
    constructor(id: string, feature_type: string) {
        super(id)
        this.type = 'Feature';
        this.properties = { 
            color : 'black'
            , index : 0
            , mowing_order:9999
            , feature_type: feature_type
        };
        this.geometry = {type:'Polygon', coordinates:[]} as Polygon;
    }

    setGeometry(geometry: Polygon) {
        this.geometry = geometry;
    }

    transpose( points: Point32[], offsetX: number, offsetY: number, datum: [number,number,number]) {
        this.geometry.coordinates = [points.map((point) => {
            return transpose(offsetX, offsetY, datum, point.Y||0, point.X||0)
        })];
    }



    setColor(color: string) : MowingFeatureBase {
        this.properties.color = color;
        return this;
    }
}


export class ObstacleFeature extends MowingFeatureBase {
    mowing_area: MowingAreaFeature;

    constructor(id: string, mowing_area: MowingAreaFeature) {
        super(id, 'obstacle');
        this.setColor("#bf0000");
        this.mowing_area = mowing_area;
    }

    getMowingArea() : MowingAreaFeature {
        return this.mowing_area;
    }

}

export class MapAreaFeature extends MowingFeatureBase {
    area?: MapArea;

    constructor(id: string, feature_type: string) {
        super(id, feature_type);
    }

    setArea( area: MapArea, offsetX: number, offsetY: number, datum: [number,number,number]) {
        this.area = area;
        this.transpose(area.Area?.Points??[], offsetX, offsetY, datum);
    }


    getArea(): MapArea | undefined {
        return this.area;
    }
}


export class NavigationFeature extends MapAreaFeature {
    constructor(id: string) {
        super(id, 'navigation');
        this.setColor("white");
    }
}

export class MowingAreaFeature extends MapAreaFeature {

    //mowing_order: number;
  
    
    constructor(id: string, mowing_order: number ) {
        super(id, 'workarea');
        this.properties.mowing_order = mowing_order;
    
        this.setName('');
        this.setColor("#01d30d");

    }
    
    setArea( area: MapArea, offsetX: number , offsetY: number, datum: [number,number,number]  ) {
        super.setArea(area, offsetX, offsetY, datum);
        this.setName(area.Name ?? '')
    }


    setName(name: string) : MowingAreaFeature {
        this.properties['name'] = name;
        if (this.area)
            this.area.Name = name;
        return this;
    }

    getName() : string {
        return this.properties?.name ?  this.properties?.name : '';
    }


    getMowingOrder() : number {
        return this.properties.mowing_order;
    }

    setMowingOrder(val: number) : MowingAreaFeature{
        this.properties.mowing_order = val;
        return this;
    }

    getIndex() : number {
        return this.properties.mowing_order-1;
    }

    getLabel() : string {
        const name = this.getName();
        return name ? name  + " (" + this.getMowingOrder().toString() +")" : "Area " + this.getMowingOrder().toString();
    }

    
}