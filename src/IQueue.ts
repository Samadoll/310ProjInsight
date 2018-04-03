export default class IQueue {
    private data: any[];
    constructor() {
        this.data = [];
    }
    public enqueue(item: any): void {
        this.data.push(item);
    }
    public dequeue(): any {
        return this.data.shift();
    }
    public enqueueAll(queue: IQueue): void {
        for (const element of queue.getData()) {
            this.data.push(element);
        }
    }
    public length(): number {
        return this.data.length;
    }
    public getElement(index: number): any {
        return this.data[index];
    }
    public splice(index: number, num: number): void {
        this.data.splice(index, num);
    }
    public getData(): any[] {
        return this.data;
    }
}
